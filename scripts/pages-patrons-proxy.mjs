const UPSTREAM_URL = 'https://thinaticsystem.com/workers/patrons';
const UPSTREAM_TIMEOUT_IN_MS = 8_000;
const MAX_BODY_SIZE_IN_BYTES = 64 * 1_024;
const PRIVATE_ERROR_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function errorResponse(status, error) {
  return new Response(JSON.stringify({error}), {status, headers: PRIVATE_ERROR_HEADERS});
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep only the public Patreon fields currently consumed by the home-page UI. */
export function normalizePublicPatrons(value) {
  if (!Array.isArray(value)) throw new Error('patrons schema must be an array');
  return value.map((patron) => {
    const data = patron?.data;
    const attributes = data?.attributes;
    if (!isRecord(patron) || !isRecord(data) || !isRecord(attributes)
      || typeof attributes.full_name !== 'string'
      || !Number.isSafeInteger(attributes.lifetime_support_cents) || attributes.lifetime_support_cents < 0
      || (attributes.patron_status !== undefined && attributes.patron_status !== null && typeof attributes.patron_status !== 'string')) {
      throw new TypeError('patrons schema is invalid');
    }
    return {
      data: {
        attributes: {
          full_name: attributes.full_name,
          lifetime_support_cents: attributes.lifetime_support_cents,
          ...(attributes.patron_status === undefined ? {} : {patron_status: attributes.patron_status}),
        },
      },
    };
  });
}

async function readBoundedBody(response, maxBodySizeInBytes) {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > maxBodySizeInBytes) {
    await response.body?.cancel().catch(() => {});
    throw new RangeError('upstream response exceeds the configured size bound');
  }
  if (response.body === null) throw new TypeError('upstream response has no body');
  const reader = response.body.getReader();
  const chunks = [];
  let totalSizeInBytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      totalSizeInBytes += value.byteLength;
      if (totalSizeInBytes > maxBodySizeInBytes) {
        await reader.cancel().catch(() => {});
        throw new RangeError('upstream response exceeds the configured size bound');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(totalSizeInBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  } finally {
    try { await reader.cancel(); } catch { /* stream may already be closed or errored */ }
    reader.releaseLock();
  }
}

/** Serve one fixed, public upstream collection; all unrelated paths go to static assets. */
export async function handlePagesRequest(request, env, {
  fetchImpl = globalThis.fetch,
  timeoutInMs = UPSTREAM_TIMEOUT_IN_MS,
  maxBodySizeInBytes = MAX_BODY_SIZE_IN_BYTES,
} = {}) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== '/workers/patrons') return env.ASSETS.fetch(request);
  if (request.method !== 'GET') {
    const response = errorResponse(405, 'method_not_allowed');
    response.headers.set('Allow', 'GET');
    return response;
  }

  const controller = new AbortController();
  let deadlineElapsed = false;
  const deadline = setTimeout(() => {
    deadlineElapsed = true;
    controller.abort();
  }, timeoutInMs);
  let upstream;
  try {
    upstream = await fetchImpl(UPSTREAM_URL, {
      method: 'GET',
      headers: {Accept: 'application/json'},
      redirect: 'manual',
      signal: controller.signal,
    });
    if (deadlineElapsed) return errorResponse(504, 'patrons_upstream_timeout');
    if (upstream.status >= 300 && upstream.status < 400) return errorResponse(502, 'patrons_upstream_unavailable');
    if (!upstream.ok) return errorResponse(502, 'patrons_upstream_unavailable');

    const body = await readBoundedBody(upstream, maxBodySizeInBytes);
    if (deadlineElapsed) return errorResponse(504, 'patrons_upstream_timeout');
    const payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(body));
    const patrons = normalizePublicPatrons(payload);
    return new Response(JSON.stringify(patrons), {status: 200, headers: PRIVATE_ERROR_HEADERS});
  } catch (error) {
    if (deadlineElapsed || controller.signal.aborted) return errorResponse(504, 'patrons_upstream_timeout');
    if (error instanceof RangeError || error instanceof TypeError || error instanceof SyntaxError) {
      return errorResponse(502, 'patrons_upstream_invalid');
    }
    return errorResponse(502, 'patrons_upstream_unavailable');
  } finally {
    clearTimeout(deadline);
    try { await upstream?.body?.cancel(); } catch { /* response stream may already be consumed */ }
  }
}
