export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Natsha-Upload-Key,X-File-Name,X-File-Type',
      'Access-Control-Expose-Headers': 'Content-Length,Content-Type,ETag',
      'Cache-Control': 'public, max-age=31536000, immutable'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'natsha-family-media' }, 200, cors);
    }

    if (url.pathname === '/upload' && request.method === 'POST') {
      const key = request.headers.get('X-Natsha-Upload-Key') || '';
      if (!env.UPLOAD_KEY || !safeEqual(key, env.UPLOAD_KEY)) {
        return json({ ok: false, error: 'Unauthorized' }, 401, cors);
      }

      const mime = (request.headers.get('X-File-Type') || 'application/octet-stream').toLowerCase();
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime) && !/^video\/(mp4|webm|quicktime)$/.test(mime)) {
        return json({ ok: false, error: 'Unsupported media type' }, 415, cors);
      }

      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared > 20 * 1024 * 1024) {
        return json({ ok: false, error: 'File too large' }, 413, cors);
      }

      const body = await request.arrayBuffer();
      if (!body.byteLength || body.byteLength > 20 * 1024 * 1024) {
        return json({ ok: false, error: 'Invalid file size' }, 413, cors);
      }

      const original = request.headers.get('X-File-Name') || 'media';
      const ext = extensionFor(mime);
      const objectKey = `ads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;

      await env.MEDIA_BUCKET.put(objectKey, body, {
        httpMetadata: {
          contentType: mime,
          cacheControl: 'public, max-age=31536000, immutable'
        },
        customMetadata: {
          originalName: original.slice(0, 180),
          source: 'natsha-family-business-ads'
        }
      });

      const publicBase = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
      const publicUrl = publicBase ? `${publicBase}/media/${objectKey}` : `${url.origin}/media/${objectKey}`;
      return json({ ok: true, key: objectKey, url: publicUrl, type: mime.startsWith('video/') ? 'video' : 'image' }, 200, cors);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/media/')) {
      const objectKey = decodeURIComponent(url.pathname.slice('/media/'.length));
      if (!/^ads\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif|mp4|webm|mov)$/i.test(objectKey)) {
        return new Response('Not found', { status: 404, headers: cors });
      }

      const object = await env.MEDIA_BUCKET.get(objectKey);
      if (!object) return new Response('Not found', { status: 404, headers: cors });

      const headers = new Headers(cors);
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);
      headers.set('Content-Disposition', 'inline');
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
      return new Response(object.body, { status: 200, headers });
    }

    return new Response('Not found', { status: 404, headers: cors });
  }
};

function extensionFor(mime) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov'
  }[mime] || 'bin';
}

function json(value, status, headers) {
  const h = new Headers(headers || {});
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(value), { status, headers: h });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
