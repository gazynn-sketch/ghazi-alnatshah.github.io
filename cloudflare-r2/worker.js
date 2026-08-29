const ALLOWED_TYPES = new Map([
  ['image/jpeg', { ext: 'jpg', maxBytes: 5 * 1024 * 1024 }],
  ['image/png', { ext: 'png', maxBytes: 5 * 1024 * 1024 }],
  ['image/webp', { ext: 'webp', maxBytes: 5 * 1024 * 1024 }],
  ['image/gif', { ext: 'gif', maxBytes: 5 * 1024 * 1024 }],
  ['video/mp4', { ext: 'mp4', maxBytes: 12 * 1024 * 1024 }],
  ['video/webm', { ext: 'webm', maxBytes: 12 * 1024 * 1024 }],
  ['video/quicktime', { ext: 'mov', maxBytes: 12 * 1024 * 1024 }]
]);

const OBJECT_KEY_RE = /^ads\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    try {

    if (request.method === 'OPTIONS') {
      if (!cors) return json({ ok: false, error: 'Origin not allowed' }, 403);
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'natsha-family-media' }, 200, cors);
    }

    if (url.pathname === '/upload' && request.method === 'POST') {
      // Apps Script server-to-server requests do not send Origin. Browser
      // requests still must match the one configured production origin.
      if (origin && !cors) return json({ ok: false, error: 'Origin not allowed' }, 403);
      const auth = await authorizeUpload(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, cors);

      const mime = normalizeContentType(request.headers.get('Content-Type'));
      const rule = ALLOWED_TYPES.get(mime);
      if (!rule) return json({ ok: false, error: 'Unsupported media type' }, 415, cors);

      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared && (!Number.isFinite(declared) || declared > rule.maxBytes)) {
        return json({ ok: false, error: 'File too large' }, 413, cors);
      }

      const body = await readBodyWithLimit(request.body, rule.maxBytes);
      if (!body || !body.byteLength) {
        return json({ ok: false, error: 'Invalid file size' }, 413, cors);
      }
      if (!matchesSignature(body, mime)) {
        return json({ ok: false, error: 'File content does not match its type' }, 415, cors);
      }

      const objectKey = `ads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${rule.ext}`;
      const originalName = safeOriginalName(request.headers.get('X-File-Name'));
      await env.MEDIA_BUCKET.put(objectKey, body, {
        httpMetadata: {
          contentType: mime,
          cacheControl: 'public, max-age=31536000, immutable'
        },
        customMetadata: {
          originalName,
          source: 'natsha-family-business-ads',
          authScope: auth.scope,
          sessionFingerprint: auth.fingerprint
        }
      });

      const publicBase = String(env.PUBLIC_BASE_URL || url.origin).replace(/\/$/, '');
      return json({
        ok: true,
        key: objectKey,
        url: `${publicBase}/media/${objectKey}`,
        type: mime.startsWith('video/') ? 'video' : 'image',
        mimeType: mime,
        size: body.byteLength
      }, 201, cors);
    }

    if (url.pathname === '/cleanup' && request.method === 'POST') {
      if (origin && !cors) return json({ ok: false, error: 'Origin not allowed' }, 403);
      const auth = await authorizeUpload(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, cors);
      let payload;
      try { payload = await request.json(); } catch (_) { payload = {}; }
      const keys = Array.isArray(payload.keys) ? payload.keys.filter(key => OBJECT_KEY_RE.test(String(key))).slice(0, 5) : [];
      const owned = [];
      for (const key of keys) {
        const object = await env.MEDIA_BUCKET.head(key);
        if (object && object.customMetadata && object.customMetadata.sessionFingerprint === auth.fingerprint) owned.push(key);
      }
      if (owned.length) await env.MEDIA_BUCKET.delete(owned);
      return json({ ok: true, deleted: owned.length }, 200, cors);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/media/')) {
      const objectKey = decodeURIComponent(url.pathname.slice('/media/'.length));
      if (!OBJECT_KEY_RE.test(objectKey)) return mediaNotFound(cors);
      return serveObject(request, env.MEDIA_BUCKET, objectKey, cors);
    }

    return new Response('Not found', { status: 404, headers: securityHeaders(cors) });
    } catch (error) {
      console.error(JSON.stringify({ message: 'request failed', path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      if (error instanceof BodyTooLargeError) return json({ ok: false, error: 'File too large' }, 413, cors);
      return json({ ok: false, error: 'Internal server error' }, 500, cors);
    }
  }
};

class BodyTooLargeError extends Error {}

async function readBodyWithLimit(stream, maxBytes) {
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new BodyTooLargeError('Request body exceeds limit'); }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function authorizeUpload(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const scope = (request.headers.get('X-Natsha-Auth-Scope') || 'business').toLowerCase();
  if (!token || token.length > 300) return { ok: false, status: 401, error: 'Missing session' };
  if (scope !== 'business' && scope !== 'admin') return { ok: false, status: 400, error: 'Invalid auth scope' };
  if (!env.AUTH_VALIDATE_URL || !/^https:\/\/script\.google\.com\/macros\/s\//.test(env.AUTH_VALIDATE_URL)) {
    return { ok: false, status: 503, error: 'Authentication service is not configured' };
  }

  const payload = scope === 'admin'
    ? { action: 'session', token }
    : { action: 'businessAdsSession', businessToken: token };
  try {
    const response = await fetch(env.AUTH_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ payload: JSON.stringify(payload) }),
      redirect: 'follow'
    });
    const result = await response.json();
    if (!response.ok || !result.ok) return { ok: false, status: 401, error: 'Invalid or expired session' };
    return { ok: true, scope, fingerprint: await fingerprintToken(token) };
  } catch (_) {
    return { ok: false, status: 503, error: 'Authentication service unavailable' };
  }
}

async function fingerprintToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function serveObject(request, bucket, key, cors) {
  const range = parseRange(request.headers.get('Range'));
  const object = request.method === 'HEAD'
    ? await bucket.head(key)
    : await bucket.get(key, range ? { range } : undefined);
  if (!object) return mediaNotFound(cors);

  const headers = securityHeaders(cors);
  object.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', object.httpEtag);
  headers.set('Content-Disposition', 'inline');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  let status = 200;
  if (range && object.range) {
    status = 206;
    headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
  } else if (object.size != null) {
    headers.set('Content-Length', String(object.size));
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

function parseRange(value) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(String(value || ''));
  if (!match) return null;
  const offset = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  if (end != null && (!Number.isSafeInteger(end) || end < offset)) return null;
  return end == null ? { offset } : { offset, length: end - offset + 1 };
}

function matchesSignature(bytes, mime) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v, i) => bytes[i] === v);
  if (mime === 'image/gif') return ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a';
  if (mime === 'image/webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
  if (mime === 'video/mp4' || mime === 'video/quicktime') return ascii(bytes, 4, 4) === 'ftyp';
  if (mime === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function normalizeContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function safeOriginalName(value) {
  return String(value || 'media').replace(/[\r\n\0]/g, '').slice(0, 180);
}

function corsHeaders(origin, allowedOrigin) {
  const allowed = String(allowedOrigin || '').replace(/\/$/, '');
  if (!origin || !allowed || origin !== allowed) return null;
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-File-Name,X-Natsha-Auth-Scope');
  headers.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Content-Type,ETag');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

function securityHeaders(base) {
  const headers = new Headers(base || {});
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return headers;
}

function mediaNotFound(cors) {
  return new Response('Not found', { status: 404, headers: securityHeaders(cors) });
}

function json(value, status, cors) {
  const headers = securityHeaders(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(value), { status, headers });
}
