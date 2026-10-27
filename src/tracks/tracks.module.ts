import { Module } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { AppleMusicClient } from './providers/apple-music.client';
import { FloClient } from './providers/flo.client';
import { GenieClient } from './providers/genie.client';
import { MelonClient } from './providers/melon.client';
import { SpotifyClient } from './providers/spotify.client';
import { YouTubeClient } from './providers/youtube.client';
import { AiMatchAdvisor } from './ai-match-advisor';

@Module({
  controllers: [TracksController],
  providers: [
    AiMatchAdvisor,
    TracksService,
    SpotifyClient,
    YouTubeClient,
    AppleMusicClient,
    FloClient,
    GenieClient,
    MelonClient,
  ],
  exports: [TracksService],
})
export class TracksModule {}
