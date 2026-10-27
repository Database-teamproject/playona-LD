import { musicFetch } from './music-fetch';
export async function fetchHtml(url: string): Promise<string | null> {
  const res = await musicFetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  if (!res.ok) return null;
  return res.text();
}

export function htmlToLines(html: string): string[] {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(
        /<\/(div|p|li|section|article|header|footer|tr|td|th|h1|h2|h3|h4|h5|h6|dt|dd)>/gi,
        '\n',
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, ''),
  );

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function findValueAfterLabel(lines: string[], label: string): string | null {
  const index = lines.findIndex((line) => line === label);
  return index >= 0 ? (lines[index + 1] ?? null) : null;
}

export function parseDurationMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;

  const [, a, b, c] = match;
  if (c) {
    return ((Number(a) * 60 + Number(b)) * 60 + Number(c)) * 1000;
  }
  return (Number(a) * 60 + Number(b)) * 1000;
}

export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\./g, '-').replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

export function metaContent(html: string, property: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [
        match[1].toLowerCase(),
        match[2],
      ]),
    );
    if ((attrs.property ?? attrs.name) === property && attrs.content)
      return decodeHtmlEntities(attrs.content);
  }
  return null;
}
