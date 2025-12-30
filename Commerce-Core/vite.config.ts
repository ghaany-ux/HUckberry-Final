import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images"; // Keep if you want meta images

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(), // Optional: remove if you don't need social preview images
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"), // Adjust if your src is elsewhere
      "@shared": path.resolve(import.meta.dirname, "shared"),
      // "@assets": path.resolve(import.meta.dirname, "attached_assets"), // Remove if not used
    },
  },
  root: path.resolve(import.meta.dirname, "client"), // Or "frontend" if that's your folder
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true, // Modern equivalent of "0.0.0.0" — allows local network access
    port: 5173, // Optional: default Vite port
  },
});