export function constantTimeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function adminAuth(request: Request, env: Env) {
  const header = request.headers.get('authorization') ?? '';
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !header.startsWith('Basic ')) return false;
  try {
    const [user, ...rest] = atob(header.slice(6)).split(':');
    const password = rest.join(':');
    return constantTimeEqual(user ?? '', env.ADMIN_USER) && constantTimeEqual(password, env.ADMIN_PASSWORD);
  } catch { return false; }
}

export function authRequired() {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Rising Design admin", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export function verifyCsrf(request: Request, formToken: string) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (!match || !formToken) return false;
  try { return constantTimeEqual(decodeURIComponent(match[1]), formToken); }
  catch { return false; }
}
