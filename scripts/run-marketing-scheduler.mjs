import { setTimeout } from 'node:timers/promises';
import { createRequire } from 'node:module';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const base = new URL(process.env.TENDLY_APP_URL || 'http://localhost:3000');
if (!process.env.CRON_SECRET?.trim()) throw new Error('Configure CRON_SECRET before running the scheduler.');
if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('TENDLY_APP_URL must use HTTPS or localhost.');
console.log('Marketing scheduler started; checks approved schedules once per minute.');
while (true) {
  try {
    const response = await fetch(new URL('/api/marketing/schedules/run', base), { headers: { Authorization: `Bearer ${process.env.CRON_SECRET.trim()}` }, signal: AbortSignal.timeout(55_000) });
    if (!response.ok) console.error(`Scheduler request failed (${response.status}).`);
  } catch { console.error('Scheduler could not reach the app; retrying on the next tick.'); }
  await setTimeout(60_000);
}
