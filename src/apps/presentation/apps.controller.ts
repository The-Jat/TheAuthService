import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AppsService } from '../apps.service';

import { JwtAuthGuard } from '../../oauth/presentation/guards/jwt.guard';

@Controller('apps')
export class AppsController {
  constructor(
    private appsService: AppsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req,
    @Body() body,
  ) {
    return this.appsService.createApp(
      req.user.sub,
      body.name,
      body.redirect_uri,
      body.scopes,
    );
  }
}