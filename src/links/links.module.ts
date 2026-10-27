import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [TracksModule],
  controllers: [LinksController],
  providers: [LinksService],
})
export class LinksModule {}
