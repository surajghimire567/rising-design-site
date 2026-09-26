# Rising Design & Construction — Astro on Cloudflare Workers

Server-rendered business website for **Rising Design and Construction Pvt. Ltd.** It uses Astro, Cloudflare Workers, D1 and R2, with locally hosted styling and first-party browser scripts. The supplied brand artwork is in `public/images/`.

> The sample projects, team biographies and testimonial are explicitly demo content. Replace them with approved material before launch. Company name, telephone, location and contact email were read from the supplied flyer; verify them before publishing.

## What's included

- Home, services, project portfolio/detail, testimonials, about/team, and consultation pages.
- D1-backed content and a basic protected admin at `/admin` for services, case studies, testimonials, team members and inquiries.
- Consultation form with same-origin + CSRF checks, server validation, 5 MB PDF/JPG/PNG/WebP signature checks, private R2 storage, and a no-reload confirmation with a standard form fallback.
- Resend email notification hook. The request is persisted even if mail delivery fails.
- Private inquiry attachment downloads available only inside the authenticated admin API; published portfolio assets are delivered by the same Worker.
- Migration SQL with six service entries and starter project/testimonial/team records. Migration `0003` keeps untouched examples unpublished so they cannot be mistaken for real work.

## Prerequisites

- Node.js 22 or newer and npm.
- A Cloudflare account. Workers, D1 and R2 have free-tier quotas; see `GUIDE.md` for current limits and the distinction between free quota and a guarantee of zero charges.
- A verified sender domain/account with an email API such as Resend if you want email alerts.

## Run locally

```sh
npm install
cp .env.example .dev.vars
# Edit .dev.vars: use a real long ADMIN_PASSWORD and your own email/API values.
npx wrangler login
npx wrangler d1 create rising-design-db
# Copy the returned database_id into wrangler.jsonc.
npx wrangler r2 bucket create rising-design-media
npm run db:local
npm run dev
```

Astro's Cloudflare adapter uses the bindings in `wrangler.jsonc` through the local platform proxy. If a local binding isn't visible, run `npm run build && npm run preview` to check the production adapter bundle; both use the same Worker bindings.

## Deploy to Cloudflare Workers

1. Create the D1 database and R2 bucket as shown above. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the D1 id.
2. Apply schema and starter content to the remote database: `npm run db:remote`. Migration `0003` hides the untouched sample projects, testimonial and team profiles before they can appear on the public site.
3. Set secrets (never put these in `wrangler.jsonc` or commit `.dev.vars`):

   ```sh
   npx wrangler secret put ADMIN_USER
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put RESEND_API_KEY
   ```

   Set `NOTIFICATION_EMAIL`, `RESEND_FROM`, `SITE_URL`, and `MAX_UPLOAD_BYTES` in `wrangler.jsonc`'s `vars` before deploying. Change `RESEND_FROM` to an address in a domain verified with your mail provider, and set `NOTIFICATION_EMAIL` to the real inbox. The mail settings start blank, so alerts remain off until configured.
4. Build and publish:

   ```sh
   npm run build
   npx wrangler deploy
   ```

5. Open the `workers.dev` URL printed by Wrangler. Confirm the public pages, `/contact`, `/admin`, an inquiry submission and its D1 record. Then add a custom domain in Cloudflare if desired.

Deployments run `astro build` (including type checks) and then `wrangler deploy`. For continuous deployment, connect the repository to Cloudflare Workers Builds and use `npm run build` as the build command and `npx wrangler deploy` as the deploy command, with the same secrets/bindings configured in that environment.

## Useful commands

```sh
npm run dev                    # Astro dev server with Worker platform bindings
npm run build                  # type-check and create Worker bundle
npm run preview                # preview built output locally
npm run db:local               # apply migrations to local D1
npm run db:remote              # apply migrations to production D1
npx wrangler tail               # inspect live Worker logs
```

Read `GUIDE.md` for setup explanations, data modeling decisions, the file map, security notes, and troubleshooting.
