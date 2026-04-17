import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,

    @Inject('TokenRepository')
    private tokenRepo,

    @Inject('BlacklistRepository')
    private blacklistRepo,
) {}

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
}