import { Controller, Get, Post, Body, UseGuards, Req, Query, Res, Inject, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '@core/auth/presentation/guards/jwt.guard';
import { OAuthService } from '@oauth/application/oauth.service';
import { TokenService } from '@core/auth/application/token.service';
import { Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';

@Controller('oauth')
export class OAuthController {
  private logger = new Logger(OAuthController.name);
  constructor(
    private usersService: UsersService,
    private oauthService: OAuthService,
    private tokenService: TokenService,
  ) { }

  @Post('signup')
  signup(
    @Body() body,
    @Req() req,
  ) {
    this.logger.log(
      `Signup attempt for ${body.email}`
    );
    return this.usersService.signup(
      body.email,
      body.password,
      body.name,
      req.correlationId,
    );
  }

  @Post('login')
  async login(@Body() body) {
    this.logger.log(
      `Login attempt for ${body.email}`
    );

    const user = await this.usersService.validate(
      body.email,
      body.password,
    );

    const state = body.state;

    if (!user) {
      this.logger.warn(
        `Invalid credentials for ${body.email}`
      );
      throw new UnauthorizedException('User Doesnt exist');
    }

    const code = await this.oauthService.generateCode(
      user.id,
      body.client_id,
      body.redirect_uri,
      body.code_challenge,
      body.code_challenge_method,
    );

    this.logger.log(
      `OAuth code generated for user ${user.id}`
    );

    return {
      redirect_to: `${body.redirect_uri}?code=${code}&state=${state}`,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Post('refresh')
  async refresh(@Body() body) {
    return this.tokenService.refreshToken(body.refresh_token);
  }

  @Post('logout')
  async logout(@Body() body) {
    return this.tokenService.logout(body.refresh_token, body.access_token);
  }

  @Get('authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Received authorize request`);
    await this.oauthService.validateClient(clientId, redirectUri);
    if (!state) {
      throw new UnauthorizedException('Missing state');
    }

    const frontendUrl = process.env.AUTH_FRONTEND_URL;
    const loginRoute = process.env.AUTH_FRONTEND_LOGIN_ROUTE;

    return res.redirect(
      `${frontendUrl}${loginRoute}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=${encodeURIComponent(codeChallengeMethod)}`
    );
  }

  @Post('token')
  async token(@Body() body) {
    this.logger.log(`Received token request`);
    return this.oauthService.exchangeCode(
      body.code,
      body.client_id,
      body.client_secret,
      body.redirect_uri,
      body.code_verifier,
    );
  }

  @Post('session')
  async session(@Body() body) {
    this.logger.log(
      `Session login attempt for ${body.email}`,
    );

    const user = await this.usersService.validate(
      body.email,
      body.password,
    );

    if (!user) {
      this.logger.warn(
        `Invalid credentials for ${body.email}`,
      );

      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    return this.tokenService.createSession(user);
  }
}