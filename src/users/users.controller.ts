import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  createUser(@Body() body: any) {
    const { email, password, name } = body;
    return this.usersService.createUser(email, password, name);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getUser(@Query('email') email: string) {
    return this.usersService.findByEmail(email);
  }
}