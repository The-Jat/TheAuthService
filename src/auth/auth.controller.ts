import { Controller, Get, Post, Body, UseGuards, Req, Query, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
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
      const code = Math.random().toString(36).substring(2);

      await this.authService.saveCode(user.id, body.client_id, code);

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
        return this.authService.refreshToken(body.refresh_token);
    }

    @Post('logout')
    async logout(@Body() body) {
        return this.authService.logout(body.refresh_token, body.access_token);
    }

    @Get('authorize')
    async authorize(
        @Query('client_id') clientId: string,
        @Query('redirect_uri') redirectUri: string,
        @Res() res: Response,
    ) {
        // For now assume user is logged in (we’ll improve later)

        return res.redirect(`/auth/login?client_id=${clientId}&redirect_uri=${redirectUri}`);
    }

    @Post('token')
    async token(@Body() body) {
        const { code, client_id} = body;
        return this.authService.exchangeCode(code, client_id);
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