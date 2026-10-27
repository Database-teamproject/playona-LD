import { Injectable } from '@nestjs/common';
import { TrackMetadata } from './track-metadata';
import { musicFetch } from './music-fetch';
import { parseDurationMs } from './html-scrape.util';
import { isEvidenceMatch, searchQueries } from '../track-match-verifier';

interface FloTrack {
  id: number;
  name: string;
  playTime?: string;
  artistList?: { name: string }[];
  album?: {
    title?: string;
    name?: string;
    releaseYmd?: string;
    imgList?: { size: number; url: string }[];
  };
}

@Injectable()
export class FloClient {
  async getTrack(id: string): Promise<TrackMetadata | null> {
    const res = await musicFetch(
      `https://www.music-flo.com/api/meta/v1/track/${encodeURIComponent(id)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { code: string; data?: FloTrack };
    return body.code === '2000000' && body.data ? this.toMetadata(body.data, id) : null;
  }

  async searchTrack(source: TrackMetadata): Promise<TrackMetadata | null> {
    for (const query of searchQueries(source).slice(0, 4)) {
      const res = await musicFetch(
        `https://www.music-flo.com/api/search/v2/search?keyword=${encodeURIComponent(query)}&searchType=TRACK&size=10`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) continue;
      const body = (await res.json()) as {
        data?: { list?: { type: string; list?: FloTrack[] }[] };
      };
      const candidates =
        body.data?.list
          ?.filter((group) => group.type === 'TRACK')
          .flatMap((group) => group.list ?? []) ?? [];
      for (const candidate of candidates) {
        const meta = this.toMetadata(candidate, String(candidate.id));
        if (meta && isEvidenceMatch(source, meta)) return meta;
      }
    }
    return null;
  }

  async searchCandidates(source: TrackMetadata): Promise<TrackMetadata[]> {
    for (const query of searchQueries(source).slice(0, 2)) {
      const res = await musicFetch(
        `https://www.music-flo.com/api/search/v2/search?keyword=${encodeURIComponent(query)}&searchType=TRACK&size=10`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) continue;
      const body = (await res.json()) as {
        data?: { list?: { type: string; list?: FloTrack[] }[] };
      };
      const candidates =
        body.data?.list
          ?.filter((group) => group.type === 'TRACK')
          .flatMap((group) => group.list ?? []) ?? [];
      const found = candidates
        .map((candidate) => this.toMetadata(candidate, String(candidate.id)))
        .filter((item): item is TrackMetadata => item !== null);
      if (found.length) return found;
    }
    return [];
  }

  private toMetadata(track: FloTrack, id: string): TrackMetadata | null {
    const artist = track.artistList?.[0]?.name;
    if (!track.name || !artist) return null;
    const date = track.album?.releaseYmd;
    return {
      platformSlug: 'flo',
      externalId: id,
      url: `https://www.music-flo.com/detail/track/${id}/details`,
      isrc: null,
      title: track.name,
      artist,
      album: track.album?.title ?? track.album?.name ?? null,
      releaseDate:
        date && /^\d{8}$/.test(date)
          ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
          : null,
      durationMs: parseDurationMs(track.playTime),
      thumbnailUrl:
        (track.album?.imgList?.find((image) => image.size === 500) ?? track.album?.imgList?.[0])
          ?.url ?? null,
    };
  }
}
