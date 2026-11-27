// No client clock, names, hardware identifiers, or AI credentials are accepted.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST' || !['/v1/activate', '/v1/status'].includes(path)) {
      return new Response('Not found', { status: 404 });
    }
    const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return new Response('Unauthorized', { status: 401 });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    try {
      // PRIMARY reads avoid stale replica responses. The insert is atomic and idempotent,
      // including retries after a lost activation response and parallel first launches.
      const db = env.DB.withSession('first-primary');
      if (path === '/v1/activate') {
        await db.prepare(`INSERT INTO preview_activations(token_hash)
          SELECT ? WHERE (SELECT activations_enabled FROM preview_config WHERE id=1)=1
          ON CONFLICT(token_hash) DO NOTHING`).bind(hash).run();
      }
      const row = await db.prepare(`SELECT activated_at AS activatedAt, expires_at AS expiresAt,
        unixepoch() AS serverNow FROM preview_activations WHERE token_hash=?`).bind(hash).first();
      const config = await db.prepare('SELECT activations_enabled AS enabled, unixepoch() AS now FROM preview_config WHERE id=1').first();
      const body = row ? {
        state: row.serverNow < row.expiresAt ? 'preview_active' : 'preview_expired', ...row,
        activationsEnabled: !!config?.enabled,
      } : { state: 'preview_not_activated', activatedAt: null, expiresAt: null,
        serverNow: config?.now, activationsEnabled: !!config?.enabled };
      return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return new Response('Preview service temporarily unavailable', { status: 503 });
    }
  },
};
