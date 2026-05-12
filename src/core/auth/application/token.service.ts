import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
    private logger = new Logger(TokenService.name);

    constructor(
        private jwtService: JwtService,

        @Inject('TokenRepository')
        private tokenRepo,

        @Inject('BlacklistRepository')
        private blacklistRepo,
    ) { }

    generateAccessToken(payload: any) {
        return this.jwtService.sign(payload, {
            expiresIn: '15m',
        });
    }

    generateRefreshToken(payload: any) {
        return this.jwtService.sign(payload, {
            expiresIn: '7d',
        });
    }
    async refreshToken(token: string) {
        this.logger.log(`refresh attempt`);

        try {
            // 1. verify JWT
            const payload = this.jwtService.verify(token);
            this.logger.log(`JWT verified for user: ${payload.sub}`);

            // 2. check DB
            const stored = await this.tokenRepo.findRefreshToken(token);

            if (!stored) {
                this.logger.warn(`Refresh token NOT found`);
                throw new UnauthorizedException('Invalid refresh token');
            }

            this.logger.log(`Refresh token found in DB`);

            // 3. DELETE old token (rotation)
            await this.tokenRepo.deleteRefreshToken(token);
            this.logger.log(`Old refresh token deleted`);

            // 4. generate new tokens
            const newPayload = {
                sub: payload.sub,
                email: payload.email,
                role: payload.role,
                client_id: payload.client_id,
            };

            const newAccessToken = this.generateAccessToken(newPayload);
            const newRefreshToken = this.generateRefreshToken(newPayload);

            // 5. SAVE new refresh token
            await this.tokenRepo.saveRefreshToken({
                token: newRefreshToken,
                user_id: payload.sub,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });

            this.logger.log(`New tokens issued`);

            return {
                access_token: newAccessToken,
                refresh_token: newRefreshToken,
            };

        } catch (err) {
            this.logger.error(`Refresh failed: ${err.message}`);
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

    async createSession(user: any) {
        this.logger.log(
            `Creating session for user ${user.id}`,
        );

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken =
            this.generateAccessToken(payload);

        const refreshToken =
            this.generateRefreshToken(payload);

        await this.tokenRepo.saveRefreshToken({
            token: refreshToken,
            user_id: user.id,
            expires_at: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
            ),
        });

        this.logger.log(
            `Session created for user ${user.id}`,
        );

        return {
            access_token: accessToken,
            refresh_token: refreshToken,

            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }
}