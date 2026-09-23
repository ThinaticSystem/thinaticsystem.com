import {createServer} from 'node:http';
import {createReadStream, existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';

const distRoot = process.env.DIST_ROOT ?? 'dist/app/browser';
const patronsFixturePath = process.env.PATRONS_FIXTURE ?? 'test/fixtures/patrons.json';
const patronsJson = readFileSync(patronsFixturePath, 'utf8');
JSON.parse(patronsJson);

function contentType(filePath) {
  return ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon'})[extname(filePath)] ?? 'application/octet-stream';
}

function createCloudflareLikeServer() {
  return createServer((request, response) => {
    const requestPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (requestPath === '/workers/patrons') {
      if (request.method !== 'GET') {
        response.writeHead(405, {'content-type': 'application/json; charset=utf-8', allow: 'GET'});
        response.end(JSON.stringify({error: 'method_not_allowed'}));
        return;
      }
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      response.end(patronsJson);
      return;
    }
    if (requestPath.startsWith('/workers/')) {
      response.writeHead(404, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      response.end(JSON.stringify({error: 'not_found'}));
      return;
    }
    const relativePath = normalize(decodeURIComponent(requestPath)).replace(/^\/+/, '');
    const candidate = join(distRoot, relativePath);
    const safeCandidate = candidate === distRoot || candidate.startsWith(`${distRoot}/`) ? candidate : join(distRoot, 'index.html');
    const isAssetRequest = Boolean(extname(requestPath));
    const filePath = existsSync(safeCandidate) && statSync(safeCandidate).isFile() ? safeCandidate : isAssetRequest ? null : join(distRoot, 'index.html');
    if (!filePath) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
      response.end('Not found');
      return;
    }
    response.writeHead(200, {'content-type': contentType(filePath), 'cache-control': 'no-store'});
    createReadStream(filePath).pipe(response);
  });
}

async function check(baseUrl, path, init, expectedStatus, expectedType) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const actualType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  if (response.status !== expectedStatus) throw new Error(`${path}: expected HTTP ${expectedStatus}, got ${response.status}`);
  if (!actualType.startsWith(expectedType)) throw new Error(`${path}: expected content type ${expectedType}, got ${actualType}`);
  return {path, method: init?.method ?? 'GET', status: response.status, contentType: actualType, bodyPrefix: body.slice(0, 80)};
}

async function main() {
  if (!existsSync(join(distRoot, 'index.html'))) throw new Error(`Build artifact missing: ${join(distRoot, 'index.html')}`);
  const server = createCloudflareLikeServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine local server address.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const checks = [
      await check(baseUrl, '/blog', undefined, 200, 'text/html'),
      await check(baseUrl, '/blog/article/1', undefined, 200, 'text/html'),
      await check(baseUrl, '/missing-route', undefined, 200, 'text/html'),
      await check(baseUrl, '/workers/patrons', undefined, 200, 'application/json'),
      await check(baseUrl, '/workers/patrons', {method: 'POST'}, 405, 'application/json'),
      await check(baseUrl, '/workers/unknown', undefined, 404, 'application/json'),
      await check(baseUrl, '/missing-asset.js', undefined, 404, 'text/plain'),
    ];
    const result = {schema: 'thinaticsystem-modernization/cloudflare-smoke/v2', distRoot, patronsFixturePath, server: '127.0.0.1 only; local static artifact plus explicit fixture API contract; no deploy', externalValidation: 'NOT_RUN', checks, verdict: 'PASS: local contract only'};
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
