/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // src/main.tsx 에서 직접 등록
      // public/ 의 그림·아이콘은 아래 globPatterns 로 한 번만 캐시(includeAssets 와 겹치면 설치 실패)
      manifest: {
        name: '꽃정원',
        short_name: '꽃정원',
        description: '같은 색 꽃 세 송이를 이어 피우는 광고 없는 꽃 퍼즐',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#3f7d3a',
        theme_color: '#3f7d3a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
