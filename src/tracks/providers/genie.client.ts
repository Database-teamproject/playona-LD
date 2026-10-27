import { Injectable } from '@nestjs/common';
import { TrackMetadata } from './track-metadata';
import { fetchHtml, metaContent, parseDurationMs } from './html-scrape.util';
import { isSimilar, hasMatchingArtist, searchQueries } from '../track-match-verifier';

@Injectable()
export class GenieClient {
  async getTrack(id: string): Promise<TrackMetadata | null> {
    const url = `https://www.genie.co.kr/detail/songInfo?xgnm=${encodeURIComponent(id)}`;
    const html = await fetchHtml(url);
    if (!html) return null;
    const raw = metaContent(html, 'og:title')
      ?.replace(/\s*-\s*genie\s*$/i, '')
      .trim();
    const sep = raw?.lastIndexOf(' / ') ?? -1;
    if (!raw || sep < 0) return null;
    const duration = /재생시간[^<]*<\/span>\s*<span[^>]*>(\d+:\d{2})<\/span>/.exec(html)?.[1];
    return {
      platformSlug: 'genie',
      externalId: id,
      url,
      isrc: null,
      title: raw.slice(0, sep).trim(),
      artist: raw.slice(sep + 3).trim(),
      album: null,
      releaseDate: null,
      durationMs: parseDurationMs(duration),
      thumbnailUrl: metaContent(html, 'og:image'),
    };
  }

  async searchTrack(source: TrackMetadata): Promise<TrackMetadata | null> {
    for (const query of searchQueries(source).slice(0, 4)) {
      const html = await fetchHtml(
        `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(query)}`,
      );
      const ids = [
        ...new Set(
          [...(html ?? '').matchAll(/fnPlaySong\('\s*(\d+)(?:;[^']*)?'\s*,\s*'1'\)/g)].map(
            (m) => m[1],
          ),
        ),
      ].slice(0, 5);
      const candidates = await Promise.all(ids.map((id) => this.getTrack(id).catch(() => null)));
      const match = candidates.find(
        (item) =>
          item &&
          isSimilar(source.title, item.title) &&
          hasMatchingArtist(source.artist, item.artist),
      );
      if (match) return match;
    }
    return null;
  }
  async searchCandidates(source: TrackMetadata): Promise<TrackMetadata[]> {
    for (const query of searchQueries(source).slice(0, 2)) {
      const html = await fetchHtml(
        `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(query)}`,
      );
      const ids = [
        ...new Set(
          [...(html ?? '').matchAll(/fnPlaySong\('\s*(\d+)(?:;[^']*)?'\s*,\s*'1'\)/g)].map(
            (m) => m[1],
          ),
        ),
      ].slice(0, 5);
      const candidates = await Promise.all(ids.map((id) => this.getTrack(id).catch(() => null)));
      const found = candidates.filter((item): item is TrackMetadata => item !== null);
      if (found.length) return found;
    }
    return [];
  }
}
