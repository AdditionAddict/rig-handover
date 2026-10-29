import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Page and JSON read the same night through the same reader, so they can't disagree (ADR 0001).
  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night')); // null for a bad date or no file
    if (!night) {
      return c.html(
        <Layout title="no such night" lane={lane()}>
          <p class="warn">no run log for {c.req.param('night')}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night.night}`} lane={lane()}>
        <Digest night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night')); // null for a bad date or no file
    if (!night) return c.json({ error: 'no run log for that night' }, 404);
    return c.json(night);
  });

  return app;
}
