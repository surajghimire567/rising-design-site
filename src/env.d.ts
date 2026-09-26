/// <reference types="astro/client" />
import 'cloudflare:workers';

declare global {
  interface Env {
    RESEND_API_KEY?: string;
    ADMIN_USER?: string;
    ADMIN_PASSWORD?: string;
  }
  namespace Cloudflare {
    interface Env {
      RESEND_API_KEY?: string;
      ADMIN_USER?: string;
      ADMIN_PASSWORD?: string;
    }
  }
}
