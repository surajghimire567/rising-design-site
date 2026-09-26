import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { slugify } from '../../../lib/data';
import { sameOrigin } from '../../../lib/security';
import { maxUploadBytes, storeFile, validFile } from '../../../lib/uploads';

const definitions: Record<string, { table: string; fields: string[]; uploads?: Record<string, 'image' | 'pdf'> }> = {
  services: { table: 'services', fields: ['title', 'slug', 'description', 'icon', 'short_label', 'sort_order', 'is_published'] },
  'case-studies': { table: 'case_studies', fields: ['title', 'slug', 'summary', 'body', 'service_id', 'project_date', 'is_published', 'cover_image_key', 'pdf_attachment_key'], uploads: { cover_image: 'image', pdf_attachment: 'pdf' } },
  testimonials: { table: 'testimonials', fields: ['client_name', 'company', 'quote', 'photo_key', 'is_published'], uploads: { photo: 'image' } },
  team: { table: 'team_members', fields: ['name', 'role', 'bio', 'photo_key', 'sort_order', 'is_published'], uploads: { photo: 'image' } },
  inquiries: { table: 'inquiries', fields: ['status'] },
};
const MEDIA_FIELDS = ['cover_image_key', 'pdf_attachment_key', 'photo_key'];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const clean = (value: string | File | null, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export const GET: APIRoute = async ({ params }) => {
  const collection = params.collection ?? '';
  const def = definitions[collection];
  if (!def) return json({ error: 'Not found' }, 404);
  const sql = collection === 'inquiries'
    ? 'SELECT id,name,email,phone,project_type,message,attachment_key,attachment_name,status,created_at FROM inquiries ORDER BY created_at DESC LIMIT 200'
    : `SELECT * FROM ${def.table} ORDER BY created_at DESC LIMIT 300`;
  const result = await env.DB.prepare(sql).all();
  return json({ items: result.results ?? [] });
};

export const POST: APIRoute = async ({ params, request }) => {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  const collection = params.collection ?? '';
  const def = definitions[collection];
  if (!def || collection === 'inquiries') return json({ error: 'Unsupported collection' }, 404);

  const maxBytes = maxUploadBytes(env.MAX_UPLOAD_BYTES);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes + 256_000) return json({ error: 'The upload is too large.' }, 413);
  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ error: 'Could not read the submitted form.' }, 400); }

  const submittedId = clean(form.get('id'), 64);
  if (submittedId && !/^[a-zA-Z0-9_-]{1,64}$/.test(submittedId)) return json({ error: 'Invalid record ID.' }, 400);
  const id = submittedId || crypto.randomUUID();
  const values: Record<string, string | number | null> = {};
  for (const field of def.fields) {
    if (MEDIA_FIELDS.includes(field)) continue;
    if (field === 'is_published') {
      values[field] = form.get(field) === 'on' || form.get(field) === '1' ? 1 : 0;
    } else if (field === 'sort_order') {
      const raw = clean(form.get(field), 12);
      const order = raw ? Number(raw) : 0;
      if (!Number.isSafeInteger(order) || order < 0 || order > 9999) return json({ error: 'Display order must be a whole number from 0 to 9999.' }, 400);
      values[field] = order;
    } else {
      const limit = ['body', 'bio', 'description', 'quote'].includes(field) ? 10000 : field === 'summary' ? 2000 : 500;
      values[field] = clean(form.get(field), limit) || null;
    }
  }

  if ('title' in values && !values.slug) values.slug = slugify(String(values.title ?? ''));
  if ('slug' in values && values.slug) values.slug = slugify(String(values.slug));
  if ('slug' in values && !values.slug) return json({ error: 'Enter a URL slug using letters, numbers and hyphens.' }, 400);
  if (collection === 'services' && (!values.title || !values.description)) return json({ error: 'Title and description are required.' }, 400);
  if (collection === 'case-studies' && (!values.title || !values.summary || !values.body)) return json({ error: 'Title, summary and project story are required.' }, 400);
  if (collection === 'testimonials' && (!values.client_name || !values.quote)) return json({ error: 'Client name and approved quote are required.' }, 400);
  if (collection === 'team' && (!values.name || !values.role || !values.bio)) return json({ error: 'Name, role and bio are required.' }, 400);
  if (collection === 'case-studies' && values.project_date) {
    const date = String(values.project_date);
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      return json({ error: 'Use a valid project date in YYYY-MM-DD format.' }, 400);
    }
  }

  const oldRow = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id=?`).bind(id).first<Record<string, unknown>>();
  if (submittedId && !oldRow) return json({ error: 'This record no longer exists. Refresh the list and try again.' }, 404);
  for (const field of MEDIA_FIELDS) if (def.fields.includes(field)) values[field] = typeof oldRow?.[field] === 'string' ? oldRow[field] as string : null;

  // Validate every file before writing any of them so a later invalid file cannot orphan an earlier upload.
  const uploads: Array<{ field: string; file: File; kind: 'image' | 'pdf'; property: string }> = [];
  for (const [field, kind] of Object.entries(def.uploads ?? {})) {
    const value = form.get(field);
    if (value instanceof File && value.size > 0) {
      if (!await validFile(value, kind, maxBytes)) return json({ error: `Invalid ${field} file. Check the allowed type and ${Math.ceil(maxBytes / (1024 * 1024))} MB size limit.` }, 400);
      const property = field === 'cover_image' ? 'cover_image_key' : field === 'pdf_attachment' ? 'pdf_attachment_key' : 'photo_key';
      uploads.push({ field, file: value, kind, property });
    }
  }

  const newMediaKeys: string[] = [];
  try {
    for (const upload of uploads) {
      const key = await storeFile(env.MEDIA, upload.file, 'public');
      newMediaKeys.push(key);
      values[upload.property] = key;
    }

    if (oldRow) {
      const sets = Object.keys(values).map((key) => `${key}=?`).join(',');
      await env.DB.prepare(`UPDATE ${def.table} SET ${sets} WHERE id=?`).bind(...Object.values(values), id).run();
    } else {
      const keys = Object.keys(values);
      await env.DB.prepare(`INSERT INTO ${def.table} (id,${keys.join(',')}) VALUES (${[id, ...keys].map(() => '?').join(',')})`).bind(id, ...Object.values(values)).run();
    }
  } catch {
    await Promise.all(newMediaKeys.map((key) => env.MEDIA.delete(key).catch(() => undefined)));
    return json({ error: 'Could not save. Check required fields, the related service, and make sure the URL slug is unique.' }, 409);
  }

  for (const keyName of MEDIA_FIELDS) {
    const oldKey = oldRow?.[keyName];
    if (typeof oldKey === 'string' && oldKey.startsWith('public/') && oldKey !== values[keyName]) await env.MEDIA.delete(oldKey).catch(() => undefined);
  }
  return json({ ok: true, id });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  if (params.collection !== 'inquiries') return json({ error: 'Unsupported collection' }, 404);
  let body: { id?: string; status?: string };
  try { body = await request.json() as { id?: string; status?: string }; }
  catch { return json({ error: 'Invalid request body.' }, 400); }
  const { id, status } = body;
  if (!id || id.length > 64 || !['new', 'contacted', 'in_progress', 'closed'].includes(status ?? '')) return json({ error: 'Invalid inquiry status.' }, 400);
  const result = await env.DB.prepare('UPDATE inquiries SET status=? WHERE id=?').bind(status, id).run();
  if (!result.meta.changes) return json({ error: 'Inquiry not found.' }, 404);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  const def = definitions[params.collection ?? ''];
  if (!def || params.collection === 'inquiries') return json({ error: 'Unsupported collection' }, 404);
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return json({ error: 'Missing or invalid id.' }, 400);
  const oldRow = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id=?`).bind(id).first<Record<string, unknown>>();
  if (!oldRow) return json({ error: 'Record not found.' }, 404);
  await env.DB.prepare(`DELETE FROM ${def.table} WHERE id=?`).bind(id).run();
  for (const keyName of MEDIA_FIELDS) {
    const key = oldRow[keyName];
    if (typeof key === 'string' && key.startsWith('public/')) await env.MEDIA.delete(key).catch(() => undefined);
  }
  return json({ ok: true });
};
