import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppsService } from 'src/apps/apps.service';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private appsService: AppsService,
    private db: DatabaseService,
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
        await this.db.query(
            `INSERT INTO refresh_tokens (user_id, token)
            VALUES ($1, $2)`,
            [user.id, refreshToken],
        );

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
            const tokens = await this.db.query(
                `SELECT * FROM refresh_tokens WHERE token = $1`,
                [token],
            );

            if (!tokens[0]) {
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
        await this.db.query(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [refreshToken],
        );

        // decode token to get expiry
        const decoded: any = this.jwtService.decode(accessToken);

        await this.db.query(
            `INSERT INTO token_blacklist (token, expires_at)
            VALUES ($1, to_timestamp($2))`,
            [accessToken, decoded.exp],
        );

        return { message: 'Logged out successfully' };
    }
}