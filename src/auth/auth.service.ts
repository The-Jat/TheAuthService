import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppsService } from 'src/apps/apps.service';
import type { TokenRepository } from './interfaces/token.repository';
import type { BlacklistRepository } from './interfaces/blacklist.repository';
import type { CodeRepository } from './interfaces/code.repository';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private appsService: AppsService,
    @Inject('TokenRepository')
    private tokenRepo: TokenRepository,
    @Inject('BlacklistRepository')
    private blacklistRepo: BlacklistRepository,
    @Inject('CodeRepository')
    private codeRepo: CodeRepository,
) {}

  async signup(email: string, password: string, name: string) {
    const hash = await bcrypt.hash(password, 10);

    return this.usersService.createUser( email, hash, name);
  }

  async validate(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) return null;

    return user;
  }

    async generateToken(user: any, app: any) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            client_id: app.client_id,
        };

        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '15m',
        });

        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: '7d',
        });

        // store refresh token in DB
        await this.tokenRepo.saveRefreshToken(user.id, refreshToken);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }

    async getProfile(userId: number) {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // remove password before returning
        const { password, ...safeUser } = user;

        return safeUser;
    }

    async validateApp(clientId: string, clientSecret: string) {
        const app = await this.appsService.findByClientId(clientId);

        if (!app) return null;

        if (app.client_secret !== clientSecret) return null;

        return app;
    }

    async refreshToken(token: string) {
        try {
            const payload = this.jwtService.verify(token);

            // check if token exists in DB
            const tokensExists = await this.tokenRepo.findRefreshToken(token);

            if (!tokensExists) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // generate new access token
            const newAccessToken = this.jwtService.sign({
                sub: payload.sub,
                email: payload.email,
                role: payload.role,
                client_id: payload.client_id,
            }, {
                expiresIn: '15m',
            });

            return {
                access_token: newAccessToken,
            };
        } catch (err) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(refreshToken: string, accessToken: string) {
        // delete refresh token
        await this.tokenRepo.deleteRefreshToken(refreshToken);

        // decode token to get expiry
        const decoded: any = this.jwtService.decode(accessToken);

        await this.blacklistRepo.add(accessToken, decoded.exp);

        return { message: 'Logged out successfully' };
    }

    async saveCode(userId: number, clientId: string, redirectUri: string, code: string) {
        const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min

        await this.codeRepo.create(userId, clientId, code, expiresAt, redirectUri);
    }

    async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string) {
        const stored = await this.codeRepo.find(code);

        if (!stored) throw new UnauthorizedException('Invalid code');

        // validate client
        const app = await this.appsService.findByClientId(clientId);
        if (!app) {
            throw new UnauthorizedException('Invalid client');
        }

        // validate secret
        if (app.client_secret !== clientSecret) {
            throw new UnauthorizedException('Invalid client secret');
        }

        // validate redirect URI
        if (stored.redirect_uri != redirectUri) {
            throw new UnauthorizedException('Invalid redirect URI');
        }

        // validate ownership
        if (stored.client_id != clientId) {
            throw new UnauthorizedException('Code does not belong to client');
        }

        // check expiry
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = new Date(stored.expires_at).getTime() / 1000;
        if (now > expiresAt) {
            throw new UnauthorizedException('Code expired');
        }

        // delete code (one-time use)
        await this.codeRepo.delete(code);

        const user = await this.usersService.findById(stored.user_id);

        return this.generateToken(user, app);
    }
}