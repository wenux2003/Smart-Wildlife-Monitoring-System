import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Wildlife Guardian",
        short_name: "Wildlife",
        theme_color: "#163a2a",
        display: "standalone",
        start_url: "/",
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
