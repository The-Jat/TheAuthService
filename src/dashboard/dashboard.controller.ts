import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { UsersService } from 'src/users/users.service';

import { TokenService } from 'src/core/auth/application/token.service';
import { AuthenticationService } from 'src/authentication/application/authentication.service';
import { LoginDto } from './dto/login.dto';
import { AuthProviderType } from 'src/authentication/domain/auth-provider.types';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private authenticationService: AuthenticationService,
    private tokenService: TokenService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authenticationService
    .authenticate(
      AuthProviderType.PASSWORD,
      {
        email: body.email,
        password: body.password,
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    return this.tokenService.createSession(
      user,
    );
  }
}