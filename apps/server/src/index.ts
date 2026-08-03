import { createServer } from 'node:http';
import { challengeManifest, simulationVersion } from '@gravity-run/game-config';
import { createReplayEnvelope } from '@gravity-run/shared';

const port = Number(process.env.PORT ?? 8787);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'ok', simulationVersion }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/challenges/daily') {
    response.writeHead(200, { 'Cache-Control': 'public, max-age=60' });
    response.end(JSON.stringify(challengeManifest));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/replays') {
    const requestId = crypto.randomUUID();
    response.writeHead(202);
    response.end(
      JSON.stringify(
        createReplayEnvelope({
          requestId,
          status: 'queued',
        }),
      ),
    );
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, () => {
  console.log(`Gravity Run API listening on http://localhost:${port}`);
});
