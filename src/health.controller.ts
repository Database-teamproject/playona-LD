import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
