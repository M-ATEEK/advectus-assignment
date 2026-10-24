import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the page runs on :5173 and forwards /api to the Express app on :8000.
// `npm run build` writes web/dist, which the Express app serves at / in production.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
});
