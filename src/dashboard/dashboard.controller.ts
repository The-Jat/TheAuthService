import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { UsersService } from 'src/users/users.service';

import { TokenService } from 'src/core/auth/application/token.service';
import { LoginDto } from './dto/login.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.usersService.validate(
        body.email,
        body.password,
      );

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