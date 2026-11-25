import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { problemBankPlugin } from "./problemBankPlugin.mjs";

export default defineConfig({
  plugins: [react(), problemBankPlugin()],
  preview: {
    allowedHosts: true,
  },
});
