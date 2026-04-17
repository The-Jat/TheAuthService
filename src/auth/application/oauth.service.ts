import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { AppRepository } from 'src/apps/domain/app.repository';
import type { CodeRepository } from '../domain/code.repository';
import type { UserRepository } from 'src/users/domain/user.repository';
import { TokenService } from './token.service';

@Injectable()
export class OAuthService {
  constructor(
    @Inject('CodeRepository')
    private codeRepo: CodeRepository,
    
    @Inject('UserRepository')
    private userRepo: UserRepository,
    // private appsService,
    @Inject('AppRepository')
    private appRepo: AppRepository,
    private tokenService: TokenService,
  ) {}

  async generateCode(userId: number, clientId: string, redirectUri: string) {
    const code = Math.random().toString(36).substring(2);

    const expiresAt = Math.floor(Date.now() / 1000) + 300;

    await this.codeRepo.create(userId, clientId, code, expiresAt, redirectUri);

    return code;
  }

  async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string) {
    const stored = await this.codeRepo.find(code);

    if (!stored) throw new UnauthorizedException('Invalid code');

    const app = await this.appRepo.findByClientId(clientId);

    if (!app) {
            throw new UnauthorizedException('Invalid client');
        }

    // if (!app || app.client_secret !== clientSecret) {
    //   throw new UnauthorizedException();
    // }

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
        
    await this.codeRepo.delete(code);

    const user = await this.userRepo.findById(stored.user_id);

    if (!user) {
        throw new UnauthorizedException('User not found');
    }
    
    const payload = {
      sub: user.id,
      client_id: clientId,
    };

    return {
      access_token: this.tokenService.generateAccessToken(payload),
      refresh_token: this.tokenService.generateRefreshToken({ sub: user.id }),
    };
  }
}