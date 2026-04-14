import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

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
    const user = await this.authService.validate(body.email, body.password);

    if (!user) throw new UnauthorizedException();

    const token = await this.authService.generateToken(user);
    return token;
  }
}