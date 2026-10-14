'use strict';
const http = require('node:http');
// All application auth and mutations stay in upstream's native local REST API.
const server = http.createServer((req, res) => {
  if (req.headers.origin || !['127.0.0.1:3877', 'localhost:3877'].includes(req.headers.host)) {
    res.writeHead(403); res.end('Local CLI access only'); return;
  }
  const headers = { ...req.headers, host: '127.0.0.1:3876', connection: 'close' };
  delete headers['proxy-authorization'];
  const upstream = http.request({ hostname: '127.0.0.1', port: 3876, path: req.url, method: req.method, headers, timeout: 20000 }, (reply) => {
    res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Client API unavailable. Complete setup and enable Local REST API in the app.' })); }
    else res.destroy();
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
});
server.headersTimeout = 10000;
server.requestTimeout = 25000;
const host = process.env.PROXY_TEST_LOOPBACK === '1' ? '127.0.0.1' : '0.0.0.0';
server.listen(3877, host);
