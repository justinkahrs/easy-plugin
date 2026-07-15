import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    assetsInlineLimit: 0,
    sourcemap: false
  },
  test: {
    include: ['src/**/*.test.ts']
  }
});

