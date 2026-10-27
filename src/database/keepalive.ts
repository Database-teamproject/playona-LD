import postgres from 'postgres';

/** Scheduled-only entry point; avoids booting NestJS or exposing a public endpoint. */
export async function handler(): Promise<{ status: 'ok' }> {
  const url = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Database keepalive requires DATABASE_POOL_URL');

  const db = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
  });
  try {
    await db`select id from public.platforms limit 1`;
    console.info('Daily database keepalive succeeded');
    return { status: 'ok' };
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code ?? 'UNKNOWN';
    console.error('Daily database keepalive failed', { code });
    throw new Error('Daily database keepalive failed');
  } finally {
    await db.end({ timeout: 1 });
  }
}
