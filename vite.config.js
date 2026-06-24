import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_PATH is set to '/your-repo-name/' when deploying to GitHub Pages.
  // Leave it unset (or '/') for Vercel.
  base: process.env.VITE_BASE_PATH || "/",
});
