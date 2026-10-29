import { describe, expect, it } from 'vitest';
import { digest, isNight, readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('folds the night into 5 jobs, sorted by job, and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries and keeps the last status and error', () => {
    const refresh = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup?.lastStatus).toBe('fail');
    expect(backup?.lastError).toBe('quota exceeded');
  });

  it('keeps the offset from the log', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.runs).toBe(8);
    expect(sync?.retries).toBe(1);
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('keeps a row whose owner is null', () => {
    const render = night?.rows.find((r) => r.job === 'digest/render');
    expect(render?.owner).toBeNull();
    expect(render?.lastError).toBeNull();
  });
});

describe('readNight edges', () => {
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('refuses anything that is not YYYY-MM-DD', () => {
    expect(isNight('2026-10-28')).toBe(true);
    expect(isNight('../etc/passwd')).toBe(false);
    expect(readNight('runs', '../runs/2026-10-28')).toBeNull();
  });

  it('an empty text is no rows and no bad lines', () => {
    expect(digest('')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts off-shape JSON as bad', () => {
    const text = ['{"at":"2026-10-28T23:00:00+01:00","job":"x","status":"maybe","owner":null}', '[1]', 'nope'].join('\n');
    expect(digest(text)).toEqual({ rows: [], badLines: 3 });
  });
});
