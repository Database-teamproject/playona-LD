import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import { platforms } from '../database/schema';
import { PlatformResponseDto } from './dto/platform.dto';

@Injectable()
export class PlatformsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** 활성화된 플랫폼 목록 */
  async findActive(): Promise<PlatformResponseDto[]> {
    return this.db
      .select()
      .from(platforms)
      .where(eq(platforms.isActive, true))
      .orderBy(asc(platforms.id));
  }
}
