import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run build`      → site web installable (PWA), servi sous BASE_PATH (ex. /kakeibo/ sur GitHub Pages)
// `npm run build:app`  → fichiers pour les applis natives (Electron / Capacitor), chemins relatifs, sans service worker
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || process.env.npm_package_version || '1.0.0'),
  },
  plugins: [
    react(),
    VitePWA({
      disable: mode === 'native',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kakeibo — carnet de budget',
        short_name: 'Kakeibo',
        description: 'Suis et analyse ton budget avec la méthode japonaise Kakeibo, sur tous tes appareils.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#f6f3ec',
        background_color: '#f6f3ec',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
}));
