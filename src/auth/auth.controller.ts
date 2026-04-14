import { Controller, Get, Post, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
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
  async login(@Body() body) {
      const { email, password, client_id, client_secret } = body;

      const user = await this.authService.validate(email, password);
      if (!user) throw new UnauthorizedException();

      const app = await this.authService.validateApp(client_id, client_secret);
      if (!app) throw new UnauthorizedException('Invalid client');

      return this.authService.generateToken(user, app);
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
}