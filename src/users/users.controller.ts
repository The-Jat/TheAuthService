import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScopesGuard } from 'src/auth/scopes.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  createUser(@Body() body: any) {
    const { email, password, name } = body;
    return this.usersService.createUser(email, password, name);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, new ScopesGuard(['read:users']))
  @Roles('user')
  getUser(@Query('email') email: string) {
    return this.usersService.findByEmail(email);
  }
}