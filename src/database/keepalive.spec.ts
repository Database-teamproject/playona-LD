import postgres from 'postgres';
import { handler } from './keepalive';

jest.mock('postgres', () => ({ __esModule: true, default: jest.fn() }));

describe('daily database keepalive', () => {
  const originalPoolUrl = process.env.DATABASE_POOL_URL;
  const originalUrl = process.env.DATABASE_URL;
  const query = Object.assign(jest.fn(), { end: jest.fn() });
  let successLog: jest.SpyInstance, errorLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_POOL_URL = 'postgres://test:test@localhost/playona_test';
    delete process.env.DATABASE_URL;
    query.mockResolvedValue([]);
    query.end.mockResolvedValue(undefined);
    jest.mocked(postgres).mockReturnValue(query as unknown as ReturnType<typeof postgres>);
    successLog = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalPoolUrl === undefined) delete process.env.DATABASE_POOL_URL;
    else process.env.DATABASE_POOL_URL = originalPoolUrl;
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    successLog.mockRestore();
    errorLog.mockRestore();
  });

  it('performs exactly one bounded table read and closes its connection', async () => {
    await expect(handler()).resolves.toEqual({ status: 'ok' });
    expect(postgres).toHaveBeenCalledWith(process.env.DATABASE_POOL_URL, {
      prepare: false,
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toEqual(['select id from public.platforms limit 1']);
    expect(query.end).toHaveBeenCalledWith({ timeout: 1 });
  });

  it('closes failed connections and keeps provider errors out of logs and thrown messages', async () => {
    query.mockRejectedValue(
      Object.assign(new Error('sensitive database connection details'), { code: 'XX000' }),
    );
    await expect(handler()).rejects.toThrow('Daily database keepalive failed');
    expect(errorLog).toHaveBeenCalledWith('Daily database keepalive failed', { code: 'XX000' });
    expect(query.end).toHaveBeenCalledWith({ timeout: 1 });
  });

  it('fails before connecting when credentials are missing', async () => {
    delete process.env.DATABASE_POOL_URL;
    await expect(handler()).rejects.toThrow('Database keepalive requires DATABASE_POOL_URL');
    expect(postgres).not.toHaveBeenCalled();
  });
});
