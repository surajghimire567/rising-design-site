import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// This is a full-stack SSR Worker. We disable optional Images and KV bindings so
// the starter does not provision paid add-ons it does not need.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  site: 'https://risingdesign.com.np',
});
