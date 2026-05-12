import { Body, Controller, Get, Post, Query, UseGuards, Inject } from '@nestjs/common';
// import { UsersService } from './users.service';
import { JwtAuthGuard } from '@core/auth/presentation/guards/jwt.guard';
import { RolesGuard } from '@core/auth/presentation/guards/roles.guard';
import { Roles } from '@core/auth/presentation/decorators/roles.decorator';
import { ScopesGuard } from '@core/auth/presentation/guards/scopes.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

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