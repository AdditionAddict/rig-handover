import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

// A night is a calendar date, nothing else: it can't name a path outside runsDir.
export function isNight(s: string): boolean {
  return NIGHT.test(s);
}

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

function isStatus(v: unknown): v is RunStatus {
  return v === 'ok' || v === 'retry' || v === 'fail';
}

// Parse one log line at the edge. Anything off-shape is a bad line, not an exception.
export function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (!isStatus(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && o.error !== null && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status, owner: o.owner, error: o.error ?? null };
}

export function digest(text: string): { rows: DigestRow[]; badLines: number } {
  const entries: Entry[] = [];
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (e) entries.push(e);
    else badLines++;
  }

  // Order by instant; stable sort keeps file order for equal times. `at` itself is never rewritten.
  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const byJob = new Map<string, DigestRow>();
  for (const e of entries) {
    const row = byJob.get(e.job);
    if (!row) {
      byJob.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error,
        firstAt: e.at,
        lastAt: e.at,
      });
      continue;
    }
    row.runs++;
    if (e.status === 'retry') row.retries++;
    row.lastStatus = e.status;
    if (e.error !== null) row.lastError = e.error;
    if (e.owner !== null) row.owner = e.owner;
    row.lastAt = e.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNight(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
  return { night, ...digest(text) };
};
