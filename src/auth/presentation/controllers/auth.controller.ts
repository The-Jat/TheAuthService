import { Controller, Get, Post, Body, UseGuards, Req, Query, Res, Inject, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../../application/auth.service';
import { JwtAuthGuard } from '../../presentation/guards/jwt.guard';
// import { AppsService } from 'src/apps/apps.service';
import { OAuthService } from '../../application/oauth.service';
import { TokenService } from '../../application/token.service';
import type { AppRepository } from 'src/apps/domain/app.repository';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject('AppRepository')
    private appRepo: AppRepository,
    private oauthService: OAuthService,
    private tokenService: TokenService,
  ) {}

  @Post('signup')
  signup(@Body() body) {
    return this.authService.signup(
      body.email,
      body.password,
      body.name,
    );
  }

  @Post('login')
  async login(@Body() body, @Res() res: Response) {
      const user = await this.authService.validate(body.email, body.password);

      if (!user) throw new UnauthorizedException('User Doesnt exist');
      // Generate authorization code
      const code = await this.oauthService.generateCode(
        user.id,
        body.client_id,
        body.redirect_uri,
      );

    //   await this.authService.saveCode(user.id, body.client_id, body.redirect_uri, code);

      return res.redirect(
          `${body.redirect_uri}?code=${code}`
      );
  }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@Req() req) {
        return this.authService.getProfile(req.user.sub);
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
        @Res() res: Response,
    ) {
        const app = await this.appRepo.findByClientId(clientId);

        if (!app) {
            throw new UnauthorizedException('Invalid client');
        }

        // Validate redirect URI
        if (app.redirect_uri !== redirectUri) {
            throw new UnauthorizedException('Invalid redirect URI');
        }

        return res.redirect(`/auth/login?client_id=${clientId}&redirect_uri=${redirectUri}`);
    }

    @Post('token')
    async token(@Body() body) {
        // const { code, client_id, client_secret, redirect_uri} = body;
        // return this.authService.exchangeCode(code, client_id, client_secret, redirect_uri);
        return this.oauthService.exchangeCode(
            body.code,
            body.client_id,
            body.client_secret,
            body.redirect_uri,
        );
    }

    @Get('login')
    showLogin(
        @Query('client_id') clientId: string,
        @Query('redirect_uri') redirectUri: string,
        @Res() res: Response,
    ) {
        return res.send(`
    <html>
      <body>
        <h2>Login</h2>
        <form method="POST" action="/auth/login">
          <input type="hidden" name="client_id" value="${clientId}" />
          <input type="hidden" name="redirect_uri" value="${redirectUri}" />

          <input name="email" placeholder="Email" />
          <input name="password" type="password" placeholder="Password" />

          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);
    }
}