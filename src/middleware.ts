import { env } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { adminAuth, authRequired } from './lib/security';

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname.replace(/\/+$/, '') || '/';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  if (isAdmin && !adminAuth(context.request, env)) {
    const response = authRequired();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (context.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=15552000');
  if (isAdmin) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
});
