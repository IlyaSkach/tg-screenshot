import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      "/api": {
        target: "http://localhost:3012",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:3012",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
