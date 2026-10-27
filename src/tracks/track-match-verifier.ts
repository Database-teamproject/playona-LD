import { TrackMetadata } from './providers/track-metadata';

const VERSION =
  /\b(live|remix|mix|acoustic|instrumental|inst|version|ver|edit|cover|demo|remaster(?:ed)?|sped|slowed|karaoke)\b|라이브|리믹스|어쿠스틱|반주|버전/gi;
const asian = /[가-힣\u3040-\u30ff\u4e00-\u9fff]/;
const isLatin = (value: string) => /[a-z]/i.test(value) && !asian.test(value);
const isAsian = (value: string) => asian.test(value) && !/[a-z]/i.test(value);
const versions = (value: string) => [...value.matchAll(VERSION)].map((m) => m[0].toLowerCase());

export function names(value: string): string[] {
  const cleaned = value
    .normalize('NFKC')
    .replace(
      /\s*\*\s*(?:애니메이션|영화|드라마)\s*\[[^[\]]+\]\s*(?:주제가|삽입곡|오프닝(?:\s*테마)?|엔딩(?:\s*테마)?)\s*$/,
      '',
    )
    .replace(/\s*[([]\s*(feat|ft|featuring)\.?[^)\]]*[)\]]/gi, '')
    .trim();
  const alias = /^([^()[\]]+?)\s*\(([^()]+)\)$/.exec(cleaned);
  if (alias && !versions(cleaned).length) {
    const base = alias[1].trim(),
      alt = alias[2].trim();
    if ((isLatin(base) && isAsian(alt)) || (isAsian(base) && isLatin(alt))) return [base, alt];
  }
  return [cleaned];
}

export function firstArtist(value: string): string {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if ('(（'.includes(value[i])) depth++;
    if (')）'.includes(value[i])) depth--;
    if (!depth && ',&'.includes(value[i])) return value.slice(0, i).trim();
  }
  return value.trim();
}

export function artistNames(value: string): string[] {
  const first = firstArtist(value),
    aliases = names(first);
  if (aliases.length > 1) return aliases;
  for (let i = 1; i < first.length; i++) {
    if (!/\s/.test(first[i])) continue;
    const left = first.slice(0, i).trim(),
      right = first.slice(i).trim();
    if ((isLatin(left) && isAsian(right)) || (isAsian(left) && isLatin(right)))
      return [left, right];
  }
  return aliases;
}

export function isSimilar(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  return names(left).some(
    (a) => normalize(a) && names(right).some((b) => normalize(a) === normalize(b)),
  );
}

export function hasMatchingArtist(left: string, right: string): boolean {
  return artistNames(left).some((a) => artistNames(right).some((b) => isSimilar(a, b)));
}

export function searchQueries(source: Pick<TrackMetadata, 'title' | 'artist'>): string[] {
  const titles = names(source.title).flatMap((name) => [name, name.replace(/[-‐‑‒–—]/g, '')]);
  return [
    ...new Set(
      titles.flatMap((title) => [`${title} ${artistNames(source.artist)[0]}`.trim(), title]),
    ),
  ].filter(Boolean);
}

export function hasConflictingVersion(left: string, right: string): boolean {
  return JSON.stringify(versions(left)) !== JSON.stringify(versions(right));
}

// Port of dev/c57e5f0 TrackMatchVerifier: missing metadata cannot corroborate a translation.
export function isEvidenceMatch(source: TrackMetadata, candidate: TrackMetadata): boolean {
  if (source.isrc && candidate.isrc)
    return (
      source.isrc.toUpperCase() === candidate.isrc.toUpperCase() &&
      !hasConflictingVersion(source.title, candidate.title)
    );
  const title = isSimilar(source.title, candidate.title);
  const artist = hasMatchingArtist(source.artist, candidate.artist);
  const duration =
    source.durationMs && candidate.durationMs
      ? Math.abs(source.durationMs - candidate.durationMs)
      : null;
  const datesKnown = Boolean(source.releaseDate && candidate.releaseDate);
  const datesMatch =
    datesKnown &&
    Math.abs(Date.parse(source.releaseDate!) - Date.parse(candidate.releaseDate!)) <= 86_400_000;
  if (title && artist)
    return (
      (isSimilar(names(source.title)[0], names(candidate.title)[0]) || !datesKnown || datesMatch) &&
      (duration === null || duration <= 30_000)
    );
  if (!title && !artist) return false;
  if (!title) {
    const a = names(source.title)[0],
      b = names(candidate.title)[0];
    if (
      versions(a).length ||
      versions(b).length ||
      !((isLatin(a) && isAsian(b)) || (isAsian(a) && isLatin(b)))
    )
      return false;
  }
  return (
    duration !== null &&
    duration <= (title ? 15_000 : 2_000) &&
    Boolean(source.releaseDate && source.releaseDate === candidate.releaseDate)
  );
}

export function isKoreanReleaseMatch(source: TrackMetadata, candidate: TrackMetadata): boolean {
  const titles = names(source.title);
  return (
    titles.length === 2 &&
    /[가-힣]/.test(titles[0]) &&
    /[a-z]/i.test(candidate.title) &&
    isSimilar(titles[1], candidate.title) &&
    hasMatchingArtist(source.artist, candidate.artist) &&
    !versions(source.title).length &&
    !versions(candidate.title).length &&
    Boolean(
      source.releaseDate &&
      candidate.releaseDate &&
      candidate.releaseDate >= source.releaseDate &&
      source.durationMs &&
      candidate.durationMs &&
      Math.abs(source.durationMs - candidate.durationMs) <= 2000,
    )
  );
}
