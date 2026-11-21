const MAX_REQUEST_BYTES = 12_500;
const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function json(data, status) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
}

async function submitFeedback(request, db) {
  if (request.method !== 'POST') return new Response(null, {status:405, headers:{Allow:'POST'}});
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({error:'Invalid origin'},403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({error:'Invalid format'},415);
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) return json({error:'Request too large'},413);

  let payload;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({error:'Missing request'},400);
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return json({error:'Request too large'},413);
      }
      text += decoder.decode(value,{stream:true});
    }
    payload = JSON.parse(text + decoder.decode());
  } catch {
    return json({error:'Invalid request'},400);
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (typeof payload?.id !== 'string' || !uuid.test(payload.id) || !message || message.length > 2000) {
    return json({error:'Enter feedback of 1–2000 characters'},400);
  }

  // The cap bounds anonymous submissions without retaining visitors’ IP addresses.
  const now = Date.now();
  const result = await db.prepare(`
    INSERT INTO feedback (id, message, created_at)
    SELECT ?, ?, ?
    WHERE (SELECT count(*) FROM feedback WHERE created_at > ?) < 60
    ON CONFLICT(id) DO NOTHING
  `).bind(payload.id,message,now,now - 3_600_000).run();
  if (result.meta.changes) return json({ok:true},201);

  const previous = await db.prepare('SELECT message FROM feedback WHERE id = ?').bind(payload.id).first();
  if (previous?.message === message) return json({ok:true},200);
  return previous ? json({error:'Submission already exists'},409) : json({error:'Try again later'},429);
}

export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname === '/api/feedback') {
      try { return await submitFeedback(request, env.DB); }
      catch { return json({error:'Feedback is temporarily unavailable'},503); }
    }
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) return new Response('Page not found',{status:404});
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const body = request.method === 'HEAD' ? null : asset[2] ? Uint8Array.from(atob(asset[1]),char=>char.charCodeAt(0)) : asset[1];
    return new Response(body,{headers:{'Content-Type':asset[0],'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  }
};
