import { ConfigService } from '@nestjs/config';
import { AiMatchAdvisor } from './ai-match-advisor';
import { TrackMetadata } from './providers/track-metadata';

const source: TrackMetadata = {
  platformSlug: 'spotify',
  externalId: 'source',
  url: 'https://open.spotify.com/track/source',
  title: 'Morning',
  artist: 'Artist',
  isrc: null,
  album: null,
  durationMs: 180000,
  releaseDate: '2026-01-01',
  thumbnailUrl: null,
};
const candidate = {
  ...source,
  platformSlug: 'flo',
  externalId: '123',
  url: 'https://www.music-flo.com/detail/track/123/details',
  title: '아침',
};
const config = (mode = 'assist', cap = 20) =>
  new ConfigService({
    AI_MATCHING_MODE: mode,
    OPENAI_API_KEY: 'fake-test-key',
    AI_MATCHING_MAX_REQUESTS: cap,
  });
const response = (id: string, decision = 'match') =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ decision, candidate_id: id, reason: 'localized_title' }),
            },
          ],
        },
      ],
    }),
  );

describe('guarded optional AI matching', () => {
  afterEach(() => jest.restoreAllMocks());
  it('makes no requests by default', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    expect(
      await new AiMatchAdvisor(new ConfigService()).choose(source, 'flo', [candidate], null),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows only a supplied recording with matching artist and independent duration evidence', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(response('123'));
    expect(await new AiMatchAdvisor(config()).choose(source, 'flo', [candidate], null)).toEqual(
      candidate,
    );
    fetcher.mockResolvedValue(response('invented'));
    expect(await new AiMatchAdvisor(config()).choose(source, 'flo', [candidate], null)).toBeNull();
    fetcher.mockResolvedValue(response('123'));
    expect(
      await new AiMatchAdvisor(config()).choose(
        source,
        'flo',
        [{ ...candidate, title: 'Morning (Live)' }],
        null,
      ),
    ).toBeNull();
    expect(
      await new AiMatchAdvisor(config()).choose(
        source,
        'flo',
        [{ ...candidate, artist: 'Other' }],
        null,
      ),
    ).toBeNull();
  });
  it('preserves baseline in shadow mode and on API failure', async () => {
    const baseline = { ...candidate, externalId: 'baseline' };
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(response('123'));
    expect(
      await new AiMatchAdvisor(config('shadow')).choose(source, 'flo', [candidate], baseline),
    ).toBe(baseline);
    fetcher.mockRejectedValue(new Error('timeout'));
    expect(await new AiMatchAdvisor(config()).choose(source, 'flo', [candidate], baseline)).toBe(
      baseline,
    );
  });
  it('caps requests per process and reuses strong deterministic matches', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockImplementation(async () => response('123'));
    const advisor = new AiMatchAdvisor(config('assist', 1));
    await Promise.all([1, 2, 3].map(() => advisor.choose(source, 'flo', [candidate], null)));
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear();
    const exact = { ...candidate, title: source.title };
    expect(await new AiMatchAdvisor(config()).choose(source, 'flo', [exact], exact)).toBe(exact);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
