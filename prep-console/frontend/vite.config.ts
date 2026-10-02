import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const content = fileURLToPath(new URL("../content", import.meta.url));

// In development the Flask API runs on :5000 and Vite proxies /api to it.
export default defineConfig({
  plugins: [react()],
  // The curriculum is ~2 MB of JSON. It still loads up front (the question bank and
  // search need all of it), but each content group gets its own cacheable chunk so
  // editing one track does not invalidate the app code or the other tracks.
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const p = id.split("\\").join("/");
          const m = p.match(/\/content\/(tracks|designs)\/(\w+)\.json/);
          if (m) return m[1] === "designs" ? `design-${m[2]}` : `track-${m[2]}`;
          if (p.includes("/content/")) return "content";
          if (p.includes("/node_modules/")) return "vendor";
        },
      },
    },
  },
  resolve: { alias: { "@content": content } },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:5000", "/auth": "http://127.0.0.1:5000" },
    fs: { allow: [".", content] },   // content/ sits beside frontend/
  },
});
