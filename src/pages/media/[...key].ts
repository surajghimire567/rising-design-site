import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  // Inquiry documents are private and are never served through this public media route.
  if (!key || key.startsWith('inquiries/') || key.includes('..')) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Never render user-provided HTML or arbitrary active formats from R2.
  const type = headers.get('content-type') ?? 'application/octet-stream';
  if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(type)) return new Response('Unsupported media type', { status: 415 });
  if (type === 'application/pdf') headers.set('Content-Disposition', 'attachment');
  return new Response(object.body, { headers });
};
