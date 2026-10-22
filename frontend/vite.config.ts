import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        // The proxy holds response headers back until the first body bytes,
        // so an idle SSE stream would never "open". Flush them once the
        // proxy has copied them onto the response. This ordering relies on
        // Vite 8's bundled http-proxy-3 emitting `proxyRes` before it copies
        // the headers onto `res` and pipes.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            if (
              proxyRes.headers['content-type']?.startsWith('text/event-stream')
            ) {
              setImmediate(() => {
                if (!res.destroyed && !res.writableEnded) res.flushHeaders();
              });
            }
          });
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/dialog.ts'] },
});
