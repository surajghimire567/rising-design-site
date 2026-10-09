import { env } from 'cloudflare:workers';

export const company = {
  name: env.COMPANY_NAME || 'Rising Design and Construction Pvt. Ltd.',
  shortName: 'Rising Design & Construction',
  tagline: 'Design · Drawing · Consulting · Construction',
  phones: [
    { label: 'Call / WhatsApp', number: '9779714597995', display: '+977 971-4597995' },
  ],
  email: 'risingdesignandconstruction@gmail.com',
  location: 'Jarankhu, Tarakeshwor, Kathmandu, Nepal',
  street: 'Jarankhu, Tarakeshwor',
  city: 'Kathmandu',
  heroLocation: 'Jarankhu',
};

export const whatsappChatUrl = `https://wa.me/9779714597995?text=${encodeURIComponent('Hi Rising Design, I would like to discuss a project.')}`;

// Leave href blank to hide a network from the public site until the official URL is ready.
export const socialLinks = [
  { platform: 'whatsapp', label: 'WhatsApp', href: whatsappChatUrl },
  { platform: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591453787962' },
  { platform: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/rising_design_and_construction/' },
  { platform: 'viber', label: 'Viber', href: 'viber://chat?number=%2B9779714597995' },
] as const;

export const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/case-studies', label: 'Projects' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/about', label: 'About' },
] as const;

export const processSteps = [
  { title: 'Consultation', text: 'We listen to your goals, budget and timeline, and review your land or existing drawings.' },
  { title: 'Survey & concept', text: 'Site measurement and early concepts establish a dependable basis for every decision.' },
  { title: 'Design & documentation', text: 'Municipality drawings, 3D visuals, estimates and reports — clear and ready to act on.' },
  { title: 'Construction support', text: 'Site supervision keeps quality, coordination and communication on track.' },
] as const;

export const strengths = [
  { title: 'One coordinated team', text: 'Design, costing, surveying and supervision under one roof — fewer hand-offs, fewer surprises.' },
  { title: 'Clear, honest estimates', text: 'Quantity-based costing that helps you plan with confidence before work begins.' },
  { title: 'See it before you build', text: '3D interior and exterior visuals so you can decide on layouts and finishes early.' },
  { title: 'Practical site oversight', text: 'Regular supervision focused on workmanship, safety and following the approved design.' },
] as const;

export const faqs = [
  { q: 'How do I start a project with you?', a: 'Send a consultation request, call or message us on WhatsApp. We will ask a few questions about your site, goals and timeline, then suggest a suitable next step.' },
  { q: 'Do you prepare municipality drawings?', a: 'Yes. Municipality drawing and design is one of our core services. We prepare the drawing set based on your site and requirements.' },
  { q: 'What should I share in my first message?', a: 'Your location, plot size (if known), the type of building or work, and your expected timeline. Existing drawings, photos or a lalpurja copy help, but are not required to begin.' },
  { q: 'Can you help with only one part of a project?', a: 'Absolutely. You can engage us for a single service — such as an estimate, a survey or a 3D design — or for full support from design to site supervision.' },
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
