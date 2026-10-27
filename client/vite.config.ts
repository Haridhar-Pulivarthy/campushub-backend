import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The Express backend (see ../src/app.ts); it listens on port 3000. */
const BACKEND_ORIGIN = "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the backend so the browser only talks to the Vite
    // origin — no CORS configuration is needed on the backend.
    proxy: {
      "/api": {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
    },
  },
});
