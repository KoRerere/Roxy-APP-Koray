/*
  Simple local HTTP server to receive installer callbacks.
  Logs query/body and returns 200. Use for manual verification.
*/

import http from 'http';
import url from 'url';

const PORT = process.env.PORT ? Number(process.env.PORT) : 43567;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;
  const chunks = [];

  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const bodyRaw = Buffer.concat(chunks).toString('utf8');
    const now = new Date().toISOString();
    const log = {
      time: now,
      method: req.method,
      path: pathname,
      query,
      headers: req.headers,
      body: bodyRaw,
    };
    // eslint-disable-next-line no-console
    console.log('[installer-callback]', JSON.stringify(log, null, 2));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`Report server listening on http://127.0.0.1:${PORT}`);
});


