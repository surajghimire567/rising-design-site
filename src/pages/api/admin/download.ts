import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
export const GET: APIRoute = async ({request}) => {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  if (!key.startsWith('inquiries/') || key.includes('..')) return new Response('Not found',{status:404});
  const item = await env.MEDIA.get(key);
  if (!item) return new Response('Not found',{status:404});
  const headers = new Headers(); item.writeHttpMetadata(headers);
  headers.set('Content-Disposition','attachment'); headers.set('Cache-Control','no-store'); headers.set('X-Content-Type-Options','nosniff');
  return new Response(item.body,{headers});
};
