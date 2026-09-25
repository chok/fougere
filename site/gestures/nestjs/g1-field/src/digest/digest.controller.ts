import { Controller, Get } from '@nestjs/common';
import { DigestService } from './digest.service';

@Controller('digest')
export class DigestController {
  constructor(private digest: DigestService) {}

  @Get('latest')
  latest() {
    return this.digest.latest();
  }
}
