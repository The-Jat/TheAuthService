import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import type { AppRepository } from 'src/apps/domain/app.repository';
import type { CodeRepository } from '../domain/code.repository';
import type { UserRepository } from 'src/users/domain/user.repository';
import { TokenService } from './token.service';
import type { TokenRepository } from '../domain/token.repository';
import * as bcrypt from 'bcrypt';


@Injectable()
export class OAuthService {
  private logger = new Logger(OAuthService.name);

  constructor(
    @Inject('CodeRepository')
    private codeRepo: CodeRepository,

    @Inject('UserRepository')
    private userRepo: UserRepository,
    // private appsService,
    @Inject('AppRepository')
    private appRepo: AppRepository,
    private tokenService: TokenService,
    @Inject('TokenRepository')
    private tokenRepo: TokenRepository,
  ) { }

  async generateCode(userId: number, clientId: string, redirectUri: string) {
    const code = Math.random().toString(36).substring(2);

    // const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.codeRepo.create(userId, clientId, code, expiresAt, redirectUri);

    return code;
  }

  async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string) {
    this.logger.log(`Code received: ${code}`);
    const stored = await this.codeRepo.find(code);

    if (!stored) throw new UnauthorizedException('Invalid code');

    const app = await this.appRepo.findByClientId(clientId);

    if (!app) {
      this.logger.log(`Invalid client`);
      throw new UnauthorizedException('Invalid client');
    }

    // validate secret
    // if (app.client_secret !== clientSecret) {
    //     throw new UnauthorizedException('Invalid client secret');
    // }
    const validSecret = await bcrypt.compare(
      clientSecret,
      app.client_secret,
    );

    if (!validSecret) {
      this.logger.log(`Invalid client secret`);
      throw new UnauthorizedException(
        'Invalid client secret'
      );
    }

    // validate redirect URI
    if (stored.redirect_uri != redirectUri) {
      this.logger.log(`Invalid redirect URI`);
      throw new UnauthorizedException('Invalid redirect URI');
    }

    // validate ownership
    this.logger.log(`stored client_id = ${stored.client_id}`);
    this.logger.log(`recieved client_id = ${clientId}`);
    if (stored.client_id != clientId) {
      this.logger.log(`Code does not belong to client`);
      throw new UnauthorizedException('Code does not belong to client');
    }

    this.logger.log(`Expires timestamp: ${new Date(stored.expires_at).getTime()}`);
    this.logger.log(`Now timestamp: ${Date.now()}`);
    this.logger.log(`Diff ms: ${new Date(stored.expires_at).getTime() - Date.now()}`);

    this.logger.log(`Now: ${Date.now()}`);
    this.logger.log(`Expires: ${stored.expires_at}`);

    // check expiry
    const now = Date.now();
    const expiresAt = new Date(stored.expires_at).getTime();
    if (now > expiresAt) {
      this.logger.log(`Code expired`);
      throw new UnauthorizedException('Code expired');
    }

    await this.codeRepo.delete(code);

    const user = await this.userRepo.findById(stored.user_id);

    if (!user) {
      this.logger.log(`User not found`);
      throw new UnauthorizedException('User not found');
    }

    const payload = {
      sub: user.id,
      client_id: clientId,
    };

    const accessToken = this.tokenService.generateAccessToken(payload);

    const refreshToken = this.tokenService.generateRefreshToken({
      sub: user.id,
      client_id: clientId, // include this for consistency
    });

    // STORE REFRESH TOKEN
    await this.tokenRepo.saveRefreshToken({
      token: refreshToken,
      user_id: user.id,
      // client_id: clientId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async validateClient(clientId: string, redirectUri: string) {
    const app = await this.appRepo.findByClientId(clientId);

    if (!app) {
      this.logger.log(`Invalid client`);
      throw new UnauthorizedException('Invalid client');
    }

    if (app.redirect_uri !== redirectUri) {
      this.logger.log(`Invalid redirect URI`);
      throw new UnauthorizedException('Invalid redirect URI');
    }

    return app;
  }
}