/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = "/gaman-log/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        id: base,
        name: "がまんログ",
        short_name: "がまん",
        description: "がまんした買い物とむだづかいを記録して、節約を見える化するアプリ",
        lang: "ja",
        display: "standalone",
        start_url: base,
        scope: base,
        theme_color: "#FFE14D",
        background_color: "#FFE14D",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        // Google Fonts はオフラインでも表示できるよう初回取得後にキャッシュする
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    // Node 25 以降はメソッドの無い localStorage をグローバルに置き、jsdom の localStorage を隠す
    execArgv: ["--no-experimental-webstorage"],
  },
});
