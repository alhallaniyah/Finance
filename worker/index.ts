// Minimal type declarations for Cloudflare Workers when workers-types are not installed
declare interface KVNamespace {
  put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException?(): void;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_AUTH_URI?: string;
  GOOGLE_TOKEN_URI?: string;
  GOOGLE_CALENDAR_SCOPE?: string;
  GOOGLE_REDIRECT_BASE?: string;
  GOOGLE_TOKENS?: KVNamespace;
}

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

function buildRedirectUri(url: URL, env: Env): string {
  const base = env.GOOGLE_REDIRECT_BASE || `${url.protocol}//${url.host}`;
  return `${base}/api/google/oauth/callback`;
}

async function handleStart(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return jsonResponse({ error: 'Missing GOOGLE_CLIENT_ID on worker' }, 500);
  }
  const url = new URL(request.url);
  const redirectUri = buildRedirectUri(url, env);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: env.GOOGLE_CALENDAR_SCOPE || 'https://www.googleapis.com/auth/calendar.events',
  });
  const authUri = (env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth') + '?' + params.toString();
  return Response.redirect(authUri, 302);
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return jsonResponse({ error: 'Missing authorization code' }, 400);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: 'Server missing Google OAuth credentials' }, 500);
  }

  const redirectUri = buildRedirectUri(url, env);
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const tokenUri = env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token';
  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return jsonResponse({ error: 'Token exchange failed', details: text }, 400);
  }

  const tokenPayload: any = await resp.json();
  if (env.GOOGLE_TOKENS) {
    await env.GOOGLE_TOKENS.put('default_tokens', JSON.stringify(tokenPayload));
  }

  const html = `
    <html><body>
      <h3>Google Calendar connected.</h3>
      <p>You can close this tab and return to the app.</p>
    </body></html>
  `;
  return htmlResponse(html);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/google/oauth/start' && request.method === 'GET') {
      return handleStart(request, env);
    }
    if (url.pathname === '/api/google/oauth/callback' && request.method === 'GET') {
      return handleCallback(request, env);
    }
    // Serve static assets (Vite build output in ./dist) for all other routes
    return env.ASSETS.fetch(request);
  },
};