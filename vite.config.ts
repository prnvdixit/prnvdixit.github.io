import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    exclude: ['marked', 'front-matter', 'github-markdown-css'],
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  define: {
    'process.platform': JSON.stringify(process.platform),
  },
});
