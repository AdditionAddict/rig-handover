import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// runs/ is read-only: every route test gets its own runs dir.
let runsDir = '';
const line = (o: object) => JSON.stringify(o);

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(
    join(runsDir, '2026-11-01.jsonl'),
    [
      line({ at: '2026-11-01T23:00:00+01:00', job: 'b/job', status: 'ok', owner: 'rook' }),
      line({ at: '2026-11-02T01:00:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e1' }),
      line({ at: '2026-11-02T01:01:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e2' }),
      line({ at: '2026-11-02T01:02:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e3' }),
      line({ at: '2026-11-02T01:03:00+01:00', job: 'a/job', status: 'ok', owner: null }),
      line({ at: '2026-11-02T02:00:00+01:00', job: 'c/job', status: 'fail', owner: 'lane-07', error: 'boom' }),
      '{"at":"2026-11-02T03:00:00+01:00","job":"d/j',
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

describe('GET /digest/:night', () => {
  it('200: renders the table sorted by job, with the banner and the marks', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app().request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html.indexOf('b/job')).toBeLessThan(html.indexOf('c/job'));
    expect(html).toContain('3 ⚠');
    expect(html).toContain('fail ⚠');
    expect(html).toContain('—'); // owner null
    expect(html).toContain('2026-11-02T01:03:00+01:00'); // offset kept
    expect(html).not.toContain('<script');
  });

  it('bad line: the night still renders and shows the count', async () => {
    const html = await (await app().request('/digest/2026-11-01')).text();
    expect(html).toContain('1 bad line skipped');
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-11-03')).status).toBe(404);
  });

  it('404 for anything that is not a date', async () => {
    expect((await app().request('/digest/..%2Frig')).status).toBe(404);
    expect((await app().request('/digest/2026-1-1')).status).toBe(404);
  });

  it('an empty night renders "nothing ran"', async () => {
    const res = await app().request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('200: the same rows, in the same order, as the page', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['a/job', 'b/job', 'c/job']);
    expect(night.rows[0]).toMatchObject({ owner: null, runs: 4, retries: 3, lastStatus: 'ok', lastError: 'e3' });

    const html = await (await app().request('/digest/2026-11-01')).text();
    const pageJobs = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(night.rows.map((r) => r.job));
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-11-03')).status).toBe(404);
  });

  it('an empty night is no rows', async () => {
    const night = (await (await app().request('/api/digest/2026-11-02')).json()) as Night;
    expect(night).toEqual({ night: '2026-11-02', rows: [], badLines: 0 });
  });
});
