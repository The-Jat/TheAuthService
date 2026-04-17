import { Body, Controller, Get, Post, Query, UseGuards, Inject } from '@nestjs/common';
// import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt.guard';
import { RolesGuard } from '../auth/presentation/guards/roles.guard';
import { Roles } from '../auth/presentation/decorators/roles.decorator';
import { ScopesGuard } from 'src/auth/presentation/guards/scopes.guard';
import type { UserRepository } from './domain/user.repository';

@Controller('users')
export class UsersController {
  constructor(
    @Inject('UserRepository')
    private userRepo: UserRepository,
  ) {}

  @Post()
  createUser(@Body() body: any) {
    const { email, password, name } = body;
    return this.userRepo.create(email, password, name);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, new ScopesGuard(['read:users']))
  @Roles('user')
  getUser(@Query('email') email: string) {
    return this.userRepo.findByEmail(email);
  }
}