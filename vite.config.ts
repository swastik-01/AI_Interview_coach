import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api-nvidia": {
        target: "https://integrate.api.nvidia.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-nvidia/, "/v1"),
      },
      "/api-sarvam": {
        target: "https://api.sarvam.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-sarvam/, "/v1"),
      },
    },
  },
  plugins: [
    react(),
    process.env.NODE_ENV === "development" ? componentTagger() : undefined,
    cloudflare()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});