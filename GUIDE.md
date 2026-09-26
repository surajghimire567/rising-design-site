# Learning guide — Rising Design & Construction

This guide walks through the project as a small production website, not a pile of snippets. The cloud runtime is **Astro SSR on Cloudflare Workers**, with **D1** for structured records and **R2** for images and PDF uploads. The public design uses the supplied Rising Design brand image, locally hosted responsive CSS, and a first-party script for no-reload inquiry form feedback.

> Verify the company name, phone, email and location read from the supplied artwork. The four case studies, testimonial and team biographies in the migrations are unmistakable sample copy, not claims about real clients or completed work. Replace them before public launch.

## 1. Project map

```text
rising-design-site/
├── astro.config.mjs                 # Astro SSR + Cloudflare adapter; disables unused features
├── wrangler.jsonc                   # Worker name, D1/R2 bindings, public runtime variables
├── package.json / package-lock.json # Reproducible Node dependencies and commands
├── .env.example                     # Local secret/template values; copy to .dev.vars
├── migrations/
│   ├── 0001_initial.sql             # D1 tables, constraints and indexes
│   └── 0002_demo_content.sql        # Six services + starter content; migration 0003 hides untouched examples
├── public/
│   ├── images/rising-logo.png       # Cropped logo from the supplied image
│   ├── images/company-flyer.png     # Clean crop of supplied promo artwork
│   └── scripts/admin.js             # Protected admin page's browser UI
└── src/
    ├── env.d.ts                     # Secret type additions to Wrangler-generated types
    ├── middleware.ts                # Admin gate + baseline security headers
    ├── lib/
    │   ├── data.ts                  # Company details, D1 query helper, slug generation
    │   ├── security.ts              # Basic auth, same-origin check, CSRF comparison
    │   └── uploads.ts               # File signatures, names and R2 object writes
    ├── layouts/BaseLayout.astro     # SEO, responsive nav, local CSS, shared footer
    ├── components/                  # Reusable service card
    ├── pages/                       # Home, services, portfolio, testimonials, about, contact
    │   ├── case-studies/[slug].astro # SEO-friendly server-rendered project details
    │   ├── admin.astro               # Protected content editor + inquiry inbox
    │   ├── api/inquiries.ts          # Public form handler
    │   ├── api/admin/[collection].ts # Whitelisted CRUD endpoints
    │   ├── api/admin/download.ts     # Authenticated private inquiry-file download
    │   └── media/[...key].ts         # Public portfolio media; blocks inquiry files
    └── styles/global.css             # Palette, typography, form controls and responsive basics
```

## 2. Architecture: what replaced Django

Django's ORM and built-in admin do not exist in Astro. This project uses D1's SQLite-compatible SQL and a small custom admin screen instead:

- Astro `.astro` pages render on the Worker request. They query D1 on the server, so titles, descriptions and case-study text are in the original HTML for search engines—not injected only after JavaScript runs.
- Files under `src/pages/api/` are server endpoints. Astro compiles them into Worker routes; there is no separate Pages Functions directory in a Workers deployment.
- `wrangler.jsonc` binds the database as `DB` and object storage as `MEDIA`. With current Astro/Cloudflare versions, handlers and pages import the request-scoped bindings from `cloudflare:workers` (see `src/pages/contact.astro` or an API route).
- The Cloudflare adapter is configured for SSR. Do not deploy this project with `wrangler pages deploy`: the selected current Astro adapter targets **Workers**, not Pages. Use `wrangler deploy` below. [^https://docs.astro.build/en/guides/integrations-guide/cloudflare/]

That distinction preserves dynamic D1-backed pages, server-side SEO, the form endpoint, and the admin panel while using the stack you selected: Astro + Workers + D1 + R2.

## 3. Data model choices

`migrations/0001_initial.sql` defines the schema. D1 has no Python/Django model classes, so the SQL schema is the source of truth.

| Table | Important fields | Why these types / links |
|---|---|---|
| `services` | `id` TEXT PK, `title`, unique `slug`, `description`, `icon`, `short_label`, sort/publish fields | UUID-like text IDs are portable across D1 and admin forms. `slug` makes public links readable and unique. Service content stays separate so the same service can be referenced by projects and inquiries. |
| `case_studies` | title/slug/summary/body, `cover_image_key`, `pdf_attachment_key`, `service_id`, `project_date` | `service_id` is a real foreign key to `services(id)`; deleting a service leaves its project but nulls the relation. R2 keys are text references, not file blobs in the SQL row. Dates are ISO calendar text for simple ordering. |
| `testimonials` | `client_name`, `company`, `quote`, optional `photo_key` | Quote is plain text and Astro escapes it. The optional photo points to R2. Do not publish a quote without client approval. |
| `team_members` | name, role, bio, optional `photo_key`, sort/publish fields | Separate rows let an authorized editor reorder or hide a profile without changing templates. |
| `inquiries` | contact fields, `project_type`, message, optional R2 key/name, `created_at`, status | Inquiries are kept separately from published content. Status uses a database `CHECK` constraint: new → contacted → in progress → closed. The uploaded file name is metadata only; the object key is random and private. |

The `is_published` flags make drafts easy to hide. The two indexes target the common public portfolio ordering and admin inbox filter. SQL query values use prepared parameters. In the admin API, table and column names are selected from hard-coded allowlists because SQL identifiers cannot be safely bound as values.

## 4. Pages and UI

- `src/layouts/BaseLayout.astro` centralizes language, viewport, title, meta description, canonical URL, navigation, skip link and footer. Every page supplies its own title/description; project detail pages use their project title and summary. Images have alt text; decorative icons are hidden from screen readers.
- Public pages (`index.astro`, `services.astro`, `case-studies/*`, `testimonials.astro`, `about.astro`, `contact.astro`) read D1 and render semantic HTML. The logo and flyer are based on the user-provided artwork. Team/project photos are optional.
- `src/styles/global.css` contains the complete first-party responsive design. The public site does not load CSS or JavaScript libraries from third-party CDNs.
- `public/scripts/site.js` enhances the standard multipart contact form with an asynchronous submit and clear success/error feedback. The form still has a normal POST action if JavaScript is unavailable.

## 5. Consultation form, files and email

`src/pages/contact.astro` creates a fresh CSRF token and sets a same-site cookie; the same token is also in a hidden input. `src/pages/api/inquiries.ts` checks the request origin and token, validates lengths, email, selected project type and message, applies a honeypot, and validates the uploaded file before saving.

The default maximum is **5 MiB** (`MAX_UPLOAD_BYTES=5242880`). Validation checks both the browser-reported MIME type and the actual file signature for PDF, JPEG, PNG and WebP. Checking only an extension or browser MIME string is not enough because those values are supplied by the client. This signature check is a strong basic filter, not a malware scanner; for confidential or high-risk documents add a scanning/quarantine service before making files available.

`storeFile()` gives each object a random key and writes bytes to the `MEDIA` R2 binding. R2 is used because a Worker deploy's local filesystem is not durable. Inquiry objects live under `inquiries/`; the public media route rejects that prefix. Admin downloads require the admin gate and return `Content-Disposition: attachment`. Public portfolio media is restricted to common image types and PDF. Deleting or replacing a public item also attempts to delete its old R2 objects.

Email uses the Resend HTTP API, not SMTP. Add the key with `wrangler secret put RESEND_API_KEY`, verify a sender domain with the mail provider, set `RESEND_FROM` to that verified sender, and set `NOTIFICATION_EMAIL` to your actual inbox. The inquiry is written to D1 first. When a request includes an accepted attachment, the Worker retrieves the saved object from private R2 and includes it in the Resend notification email; the file also remains available through the authenticated admin inbox. Email errors/timeouts are logged but do not erase a request; inspect `npx wrangler tail` if alerts are missing.

## 6. Admin panel and security

Open `/admin` and sign in with the `ADMIN_USER` / `ADMIN_PASSWORD` Cloudflare secrets. The browser's standard HTTP Basic Auth prompt is used rather than storing a password or session token in browser JavaScript. The page lets you create/edit/delete services, studies, testimonials and team members; it also lists inquiries, permits status changes, and provides private attachment downloads.

Before publishing:

1. Replace the example admin password with a unique, long secret; never commit `.dev.vars`.
2. Consider protecting `/admin*` with Cloudflare Access as a second gate, especially if the site receives public traffic. Basic Auth is simple for a first deployment, not a full staff identity system or audit log.
3. Keep HTTPS enabled on your `workers.dev` or custom domain. Do not put secrets in `wrangler.jsonc`; its `vars` section is for public configuration.
4. Keep Astro auto-escaping on. User-authored text is rendered as text; this project never applies `|safe` or raw HTML rendering to submissions.
5. Public inquiry POSTs require same-origin and double-submit CSRF checks. Admin writes also require a same-origin Origin header and authenticated API request.
6. Inquiry records contain personal data. Restrict account access and decide how long to retain records; regularly export/back up data before deletions.

## 7. Environment variables

Copy `.env.example` to **`.dev.vars`** for local Workerd development. Change `ADMIN_PASSWORD` first. Wrangler treats `.dev.vars` as local-only secrets; it is ignored by Git. In production, use Cloudflare secrets for `ADMIN_USER`, `ADMIN_PASSWORD`, `RESEND_API_KEY`. Put non-secret values (`COMPANY_NAME`, `NOTIFICATION_EMAIL`, `RESEND_FROM`, `MAX_UPLOAD_BYTES`, `SITE_URL`) in `wrangler.jsonc` under `vars` before deploying. Wrangler treats this file as the source of truth, so dashboard variables that are not reflected in the config can be replaced on the next deploy.

`src/env.d.ts` adds type declarations for secret names; `npm run dev`, `npm run build` and `npm run preview` run `wrangler types` to refresh generated D1/R2 types. This is why `worker-configuration.d.ts` is generated, not hand-edited.

## 8. Local run and first content edit

Requirements: Node.js 22+, npm, a Cloudflare account. From the project root:

```sh
npm install
cp .env.example .dev.vars
# Edit .dev.vars: unique local admin password; leave RESEND_API_KEY empty to avoid email while testing.
npx wrangler login
npx wrangler d1 create rising-design-db
# Copy the returned database_id into wrangler.jsonc.
npx wrangler r2 bucket create rising-design-media
npm run db:local
npm run dev
```

Open the local URL printed by Astro. Visit `/admin`, use the local values in `.dev.vars`, and replace the sample testimonials/projects/team bios. Keep project slugs lower-case with hyphens. In a case study, choose its related service, add a cover image or optional PDF (both at most 5 MiB), then publish it. Use the inquiry inbox to update follow-up status.

When ready to exercise the production-like runtime, stop `astro dev`, run `npm run build`, then `npm run preview`. The preview uses Workerd and the same D1/R2 bindings locally.

## 9. Deploy to the Cloudflare Workers Free plan

1. Sign in and create a D1 database:

   ```sh
   npx wrangler login
   npx wrangler d1 create rising-design-db
   ```

   Copy the returned database ID into the existing `d1_databases[0].database_id` in `wrangler.jsonc`. Keep the binding name `DB` and database name in sync.
2. Create the R2 bucket named in the config:

   ```sh
   npx wrangler r2 bucket create rising-design-media
   ```
3. Set production secrets interactively (the entered values are not put in the project):

   ```sh
   npx wrangler secret put ADMIN_USER
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put RESEND_API_KEY
   ```

   Update public `vars` in `wrangler.jsonc`: real `NOTIFICATION_EMAIL`, verified `RESEND_FROM`, your final `SITE_URL`, and company name. Change `site` in `astro.config.mjs` to the final site URL too; it helps Astro generate canonical URLs.
4. Apply migrations to the remote database. Migration `0003` safely unpublishes only the untouched example projects, testimonial and team profiles; it does not delete records or change the schema:

   ```sh
   npm run db:remote
   ```
5. Type-check, build and deploy the Worker after the database migration has completed:

   ```sh
   npm run build
   npx wrangler deploy
   ```

   Or run `npm run deploy`, which performs build + deploy. The adapter produces the Worker bundle and static assets in `dist/`; the deploy script does not apply production database migrations. Do not use a Render Procfile, `collectstatic`, WhiteNoise, `requirements.txt`, or `wrangler pages deploy` for this stack.
6. Visit the URL Wrangler prints. Test each public page, the `/admin` sign-in, a real inquiry, email notification, uploaded-file rejection/acceptance, and the admin-only attachment download. Then configure a custom domain from the Worker settings if you have one.

The `package-lock.json` records the versions used when this starter was built and checked: Astro 7.3.4, `@astrojs/cloudflare` 14.3.3, and Wrangler 4.137.0. `npm install` uses the lockfile. Upgrade in a branch, then run `npm run build` and verify the Worker preview before deploying.

## 10. Updating the live site safely

You can edit and test the project on your computer while visitors keep using the current live version. Editing a file, running `npm run dev`, `npm run build`, or `npm run preview` does not deploy it. The release command is `npm run deploy`; it builds the project and then deploys the Worker.

### For code, layout, image and style changes

1. Edit the intended files in `src/` or `public/` and save them.
2. Run `npm run dev`, open the local URL it prints, and check your change on a phone-sized and desktop-sized screen. The local site uses local development bindings by default; it does not use the live D1 database unless you deliberately configure remote bindings. Do not add `--remote` while testing.
3. Run `npm run build`. Fix any errors before continuing.
4. Stop the dev server, run `npm run preview`, and check the built site locally. Check the pages and interactions affected by your edit, such as navigation, contact form, images, and `/admin` if relevant.
5. Review your edited files in VS Code. When everything matches what you meant to change, run this one release command:

   ```sh
   npm run deploy
   ```

   This command builds again and deploys the Worker. By default Cloudflare makes the new Worker version serve 100% of traffic as the deployment completes. You do not need to put up a maintenance page for a routine code release, but test first because a bug in the new version can still affect visitors. [Cloudflare Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)

6. Open the live site and check the changed page plus the contact form. If the new Worker has a problem, `npx wrangler rollback` lets you select the previous Worker version, or use **Workers & Pages → rising-design-site → Deployments** in the Cloudflare dashboard. A Worker rollback restores code/configuration; it does not undo changes to D1 or R2 data. [Cloudflare rollback guide](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

### For text, projects, services or other `/admin` content

The live `/admin` saves directly to the production D1 database. Saving there publishes the change immediately, even though you did not deploy code. To prepare content privately, use `/admin` on your local site and its local database. When it is approved, enter it in the live `/admin` at the time you want it published. Deploying the Worker does **not** copy content from your local database to production.

### For database structure changes

Do not run `npm run db:remote` for a normal code or content update. It applies migrations to the live database and can affect live records. Treat a schema change as a separate planned release: test it against the local database first, back up production data, and make sure the old Worker version can still work with the changed schema before relying on code rollback. D1 data is separate from Worker versions and is not rolled back with them. [Cloudflare D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/)

## 11. Free-tier expectations

Cloudflare currently lists the Workers Free plan at 100,000 Worker requests/day and 10 ms CPU per invocation; requests served as static assets are free and unlimited. D1 Free currently includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. R2 Standard currently includes 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month and free internet egress. These limits are quotas, can change, and are shared across your Cloudflare account; exceeding a free quota can make a feature unavailable until the quota resets. Monitor the dashboard. A custom domain name and the separate mail provider may have costs or independent limits. [^https://developers.cloudflare.com/workers/platform/limits/] [^https://developers.cloudflare.com/d1/platform/pricing/] [^https://developers.cloudflare.com/r2/pricing/]

This starter minimizes usage with small indexed tables, capped admin lists, no image transformations, no sessions/KV, and 5 MiB uploads. Each dynamic page request still invokes the Worker; keep inquiry and project volume appropriate for the free quota.

## 12. Troubleshooting

- **`wrangler types` / build can't resolve a binding:** check `DB`/`MEDIA` names in `wrangler.jsonc`, then run `npx wrangler types` again.
- **D1 migration says database ID is invalid:** create the DB and replace the literal `REPLACE_WITH_D1_DATABASE_ID` before using `--remote`.
- **Local DB has no services:** run `npm run db:local`; local and remote D1 are distinct.
- **The admin prompt repeats or returns 401:** check secrets exactly (no accidental whitespace), set both admin secrets, and use the matching username/password.
- **File upload says unsupported:** allow only real PDF/JPEG/PNG/WebP under the configured cap. Browser MIME must match the file signature.
- **Inquiry saves but no email arrives:** verify the sender/domain with Resend, `RESEND_FROM`, `NOTIFICATION_EMAIL`, the secret key and provider quota; inspect Worker logs. A mail outage does not roll back D1.
- **Images/PDFs return 404:** confirm the `MEDIA` R2 bucket binding, object key in the D1 row, and that you uploaded through the admin. Inquiry file keys must only be downloaded through the authenticated admin link.
- **Canonical URL still says example.com:** change both `SITE_URL` in `wrangler.jsonc` and `site` in `astro.config.mjs`, then rebuild.
