import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
