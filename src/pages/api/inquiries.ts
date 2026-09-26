import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sameOrigin, verifyCsrf } from '../../lib/security';
import { cleanFilename, maxUploadBytes, storeFile, validFile } from '../../lib/uploads';

const clean = (value: FormDataEntryValue | null, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const escapeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const isEnhancedRequest = (request: Request) => request.headers.get('x-requested-with') === 'fetch';

function encodeBase64(bytes: Uint8Array) {
  const chunkSize = 3 * 8192;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))));
  }
  return chunks.join('');
}

function emailAttachmentFilename(name: string | null, contentType?: string) {
  const extensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const extension = contentType ? extensions[contentType.split(';', 1)[0].toLowerCase()] : undefined;
  const safeName = cleanFilename(name ?? 'inquiry-attachment');
  if (!extension) return safeName;
  const stem = safeName.replace(/\.[^.]*$/, '').replace(/^\.+/, '') || 'inquiry-attachment';
  return `${stem}${extension}`;
}

function reply(message: string, kind: 'error' | 'success', request: Request, status = 200) {
  const fragment = `<div class="form-status form-status--${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${escapeText(message)}</div>`;
  const body = isEnhancedRequest(request) ? fragment : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consultation request | Rising Design</title><style>body{margin:0;background:#f4f7fa;color:#172638;font:16px/1.6 system-ui,sans-serif}.page{max-width:680px;margin:10vh auto;padding:24px}.card{border:1px solid #dce4ec;border-radius:14px;background:#fff;padding:28px}.form-status{border-radius:9px;padding:14px}.form-status--error{background:#fff2f0;color:#812f27}.form-status--success{background:#effaf3;color:#205d3b}a{display:inline-block;margin-top:20px;color:#17427f}</style></head><body><main class="page"><div class="card"><h1>Rising Design</h1>${fragment}<a href="/contact">Return to the contact form</a></div></main></body></html>`;
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export const POST: APIRoute = async ({ request }) => {
  const maxBytes = maxUploadBytes(env.MAX_UPLOAD_BYTES);
  const maxMB = Math.ceil(maxBytes / (1024 * 1024));
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes + 128_000) {
    return reply(`The upload is too large. Keep attachments under ${maxMB} MB.`, 'error', request, 413);
  }
  if (!sameOrigin(request)) return reply('This request could not be verified. Reload the contact page and try again.', 'error', request, 403);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return reply('We could not read that form. Please try again.', 'error', request, 400); }

  const csrf = clean(form.get('csrf_token'), 100);
  if (!verifyCsrf(request, csrf)) return reply('Your form expired. Reload the contact page and try again.', 'error', request, 403);
  if (clean(form.get('website'), 200)) return reply('Thanks — your request has been received.', 'success', request);

  const name = clean(form.get('name'), 100).replace(/[\r\n\t ]+/g, ' ');
  const email = clean(form.get('email'), 254).toLowerCase();
  const phone = clean(form.get('phone'), 30).replace(/\s+/g, ' ');
  const projectType = clean(form.get('project_type'), 120);
  const message = clean(form.get('message'), 5000);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPhone = /^[+()0-9. -]{5,30}$/.test(phone) && /\d{5}/.test(phone.replace(/\D/g, ''));
  if (name.length < 2 || !validEmail || !validPhone || projectType.length < 2 || message.length < 10) {
    return reply('Please check your name, email, phone, project type and message, then try again.', 'error', request, 422);
  }

  const allowed = await env.DB.prepare('SELECT title FROM services WHERE is_published=1').all<{ title: string }>();
  const validTypes = new Set([...(allowed.results ?? []).map((row) => row.title), 'Other / not sure']);
  if (!validTypes.has(projectType)) return reply('Please choose a valid project type.', 'error', request, 422);

  const fileValue = form.get('attachment');
  let attachmentKey: string | null = null;
  let attachmentName: string | null = null;
  if (fileValue instanceof File && fileValue.size > 0) {
    if (!await validFile(fileValue, 'image-or-pdf', maxBytes)) {
      return reply(`Attachment rejected. Use a real PDF, JPG, PNG or WebP file no larger than ${maxMB} MB.`, 'error', request, 422);
    }
    try {
      attachmentKey = await storeFile(env.MEDIA, fileValue, 'inquiries');
      attachmentName = fileValue.name.replace(/[\r\n\u0000-\u001f]/g, '').slice(0, 160) || 'attachment';
    } catch {
      console.error('Inquiry attachment storage failed.');
      return reply('We could not save that attachment. Please try again or submit without a file.', 'error', request, 503);
    }
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO inquiries (id,name,email,phone,project_type,message,attachment_key,attachment_name) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, name, email, phone, projectType, message, attachmentKey, attachmentName).run();
  } catch {
    if (attachmentKey) await env.MEDIA.delete(attachmentKey).catch(() => undefined);
    console.error('Inquiry could not be saved to D1.');
    return reply('We could not save your request just now. Please try again or contact us by phone or email.', 'error', request, 503);
  }

  // Save the request first. A mail provider outage never removes an inquiry.
  if (env.RESEND_API_KEY && env.NOTIFICATION_EMAIL && env.RESEND_FROM) {
    let emailAttachment: { filename: string; content: string } | undefined;
    let attachmentNotice = attachmentName ?? 'None';

    if (attachmentKey) {
      try {
        const storedAttachment = await env.MEDIA.get(attachmentKey);
        if (!storedAttachment) throw new Error('Stored inquiry attachment is missing.');
        const bytes = new Uint8Array(await storedAttachment.arrayBuffer());
        emailAttachment = {
          filename: emailAttachmentFilename(attachmentName, storedAttachment.httpMetadata?.contentType),
          content: encodeBase64(bytes),
        };
      } catch {
        attachmentNotice = `${attachmentName ?? 'Uploaded file'} is saved in the admin inbox but could not be attached to this email.`;
        console.error('Inquiry attachment could not be retrieved from R2 for email.');
      }
    }

    try {
      const emailPayload: Record<string, unknown> = {
        from: env.RESEND_FROM,
        to: [env.NOTIFICATION_EMAIL],
        subject: `New consultation request: ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nProject type: ${projectType}\n\nMessage:\n${message}\n\nAttachment: ${attachmentNotice}\nInquiry ID: ${id}`,
      };
      if (emailAttachment) emailPayload.attachments = [emailAttachment];

      const mailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify(emailPayload),
      });
      if (!mailResponse.ok) console.error('Inquiry email provider returned an error.', mailResponse.status);
    } catch { console.error('Inquiry email delivery failed; the inquiry remains saved.'); }
  } else if (env.RESEND_API_KEY) {
    console.warn('Inquiry email is disabled until RESEND_FROM and NOTIFICATION_EMAIL are configured.');
  }

  return reply('Thank you. Your consultation request has been received. We’ll be in touch soon.', 'success', request);
};
