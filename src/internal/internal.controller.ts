import { UseGuards, Get, Controller } from '@nestjs/common';
import { ApiKeyGuard } from '@core/auth/presentation/guards/api-key.guard';

@Controller('internal')
export class InternalController {
  
  @Get('stats')
  @UseGuards(ApiKeyGuard)
  getStats() {
    return { message: 'Secure internal data' };
  }
}