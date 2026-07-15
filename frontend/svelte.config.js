import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      precompress: false,
      strict: true
    }),
    paths: {
      relative: true
    },
    version: {
      name: '0.1.0',
      pollInterval: 0
    }
  }
};

export default config;
