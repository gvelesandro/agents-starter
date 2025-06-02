import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [cloudflare(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy API requests to the Wrangler dev server
      "/auth": "http://localhost:8787",
      "/chat": "http://localhost:8787",
      "/check-open-ai-key": "http://localhost:8787",
      "/agents": "http://localhost:8787",
      "/threads": "http://localhost:8787",
    },
  },
});
