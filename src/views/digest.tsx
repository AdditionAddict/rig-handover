import type { DigestRow, Night } from '../digest/types.js';

// Plan morning-digest § 2a. Retries of 3 or more and any `fail` are marked, in words as well as
// colour, so the mark survives a screenshot in greyscale.
export const MANY_RETRIES = 3;

const dash = (v: string | null) => v ?? '—';

function Row({ row }: { row: DigestRow }) {
  const manyRetries = row.retries >= MANY_RETRIES;
  const failed = row.lastStatus === 'fail';
  return (
    <tr>
      <td>{row.job}</td>
      <td>{dash(row.owner)}</td>
      <td>{row.runs}</td>
      <td class={manyRetries ? 'warn' : undefined}>{manyRetries ? `${row.retries} ⚠` : row.retries}</td>
      <td class={failed ? 'warn' : undefined}>{failed ? 'fail ⚠' : row.lastStatus}</td>
      <td>{dash(row.lastError)}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.badLines > 0 ? (
        <p class="warn">
          {night.badLines} bad {night.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : (
        <p class="mute">0 bad lines</p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <Row row={r} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
