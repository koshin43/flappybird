/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: 'flappybird',
        name: 'Flappy Bird',
        short_name: 'Flappy Bird',
        description: 'The classic one-tap bird game, in original pixel art.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1e1b26',
        theme_color: '#1e1b26',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
