import { Injectable } from '@nestjs/common';
import { TrackMetadata } from './track-metadata';
import { fetchHtml, metaContent, normalizeDate } from './html-scrape.util';
import { isEvidenceMatch, searchQueries } from '../track-match-verifier';

@Injectable()
export class MelonClient {
  async getTrack(id: string): Promise<TrackMetadata | null> {
    const url = `https://www.melon.com/song/detail.htm?songId=${encodeURIComponent(id)}`;
    const html = await fetchHtml(url);
    if (!html) return null;
    const raw = metaContent(html, 'og:title');
    const sep = raw?.lastIndexOf(' - ') ?? -1;
    if (!raw || sep < 0) return null;
    const date = /발매일<\/dt>\s*<dd>(\d{4}\.\d{2}\.\d{2})<\/dd>/.exec(html)?.[1];
    return {
      platformSlug: 'melon',
      externalId: id,
      url,
      isrc: null,
      title: raw.slice(0, sep).trim(),
      artist: raw.slice(sep + 3).trim(),
      album: null,
      releaseDate: normalizeDate(date),
      durationMs: null,
      thumbnailUrl: metaContent(html, 'og:image'),
    };
  }

  async searchTrack(source: TrackMetadata): Promise<TrackMetadata | null> {
    for (const query of searchQueries(source).slice(0, 4)) {
      const html = await fetchHtml(
        `https://www.melon.com/search/song/index.htm?q=${encodeURIComponent(query)}`,
      );
      const ids = [
        ...new Set([...(html ?? '').matchAll(/data-song-no=["'](\d+)["']/g)].map((m) => m[1])),
      ].slice(0, 5);
      const candidates = await Promise.all(ids.map((id) => this.getTrack(id).catch(() => null)));
      const match = candidates.find((item) => item && isEvidenceMatch(source, item));
      if (match) return match;
    }
    return null;
  }
  async searchCandidates(source: TrackMetadata): Promise<TrackMetadata[]> {
    for (const query of searchQueries(source).slice(0, 2)) {
      const html = await fetchHtml(
        `https://www.melon.com/search/song/index.htm?q=${encodeURIComponent(query)}`,
      );
      const ids = [
        ...new Set([...(html ?? '').matchAll(/data-song-no=["'](\d+)["']/g)].map((m) => m[1])),
      ].slice(0, 5);
      const candidates = await Promise.all(ids.map((id) => this.getTrack(id).catch(() => null)));
      const found = candidates.filter((item): item is TrackMetadata => item !== null);
      if (found.length) return found;
    }
    return [];
  }
}
