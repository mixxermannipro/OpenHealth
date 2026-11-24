import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'KADENZ — Gesundheits- & Trainingsintelligenz',
          short_name: 'KADENZ',
          description:
            'Local-First Health, Erholung, Schlaf, Trainingsbelastung und KI-Kalorientracker.',
          theme_color: '#090A0C',
          background_color: '#090A0C',
          display: 'standalone',
          orientation: 'portrait',
          categories: ['health', 'fitness', 'lifestyle'],
          start_url: '/',
          scope: '/',
          share_target: {
            action: '/share-meal',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
            },
          },
          protocol_handlers: [
            {
              protocol: 'web+caltrack',
              url: '/?protocol=%s',
            },
            {
              protocol: 'web+kadenz',
              url: '/?protocol=%s',
            },
          ],
          shortcuts: [
            {
              name: 'Mahlzeit erfassen',
              short_name: 'Essen',
              description: 'Kalorien per 0 € KI-Import, Barcode oder Suche erfassen',
              url: '/?tab=nutrition',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Schlaf ansehen',
              short_name: 'Schlaf',
              description: 'Schlafdauer, Phasen und Gefühl prüfen',
              url: '/?tab=sleep',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
          ],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,jpg}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'kadenz-fonts-cache',
                expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/(world|de)\.openfoodfacts\.org\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'kadenz-off-api-cache',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
