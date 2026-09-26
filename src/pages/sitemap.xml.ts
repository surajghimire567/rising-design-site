import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

const xmlEscape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = (env.SITE_URL || site?.toString() || 'https://example.com').replace(/\/+$/, '');
  const studies = await env.DB.prepare('SELECT slug FROM case_studies WHERE is_published=1 ORDER BY project_date DESC').all<{ slug: string }>();
  const pages = ['', '/services', '/case-studies', '/testimonials', '/about', '/contact', ...(studies.results ?? []).map((study) => `/case-studies/${encodeURIComponent(study.slug)}`)];
  const urls = pages.map((path) => `  <url><loc>${xmlEscape(`${siteUrl}${path || '/'}`)}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
