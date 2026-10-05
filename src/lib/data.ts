import { env } from 'cloudflare:workers';
export const company = {
  name: env.COMPANY_NAME || 'Rising Design and Construction Pvt. Ltd.',
  shortName: 'Rising Design & Construction',
  phones: [
    { label: 'Contact No', number: '9779714597995', display: '+977 9714597995' },
  ],
  email: 'risingdesignandconstruction@gmail.com',
  location: 'Jarankhu, Tarakeshwor, Kathmandu, Nepal',
  heroLocation: 'Jarankhu',
};

export const whatsappChatUrl = `https://wa.me/9779714597995?text=${encodeURIComponent('Hi, can I know more about this?')}`;

// Add the official profile URLs here when they are ready. Blank links render as visible placeholders.
export const socialLinks = [
  { platform: 'whatsapp', label: 'WhatsApp', href: whatsappChatUrl },
   { platform: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591453787962' },
  { platform: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/rising_design_and_construction/?hl=en' },
  { platform: 'viber', label: 'Viber', href: '' },
 
] as const;

export function slugify(input: string) {
  return input.toLowerCase().trim().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 90);
}

export async function rows<T>(db: D1Database, sql: string, ...values: (string | number | null)[]) {
  const result = await db.prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}
