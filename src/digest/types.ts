// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, folded from every log line for that job.
export type DigestRow = {
  job: string;
  // null when the log says so; views render it as `—`.
  owner: string | null;
  // Log lines for this job (every attempt: ok, retry and fail).
  runs: number;
  // Lines with status `retry`.
  retries: number;
  // Status of the job's latest line.
  lastStatus: RunStatus;
  // The latest `error` the job logged, or null if it never logged one.
  lastError: string | null;
  // `at` of the job's earliest and latest line, exactly as logged (offset kept, never UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Non-blank lines that didn't parse as a log entry. Counted, never thrown.
  badLines: number;
};

// Reads `<runsDir>/<night>.jsonl`. Returns null when there is no file for that night.
export type ReadNight = (runsDir: string, night: string) => Night | null;
