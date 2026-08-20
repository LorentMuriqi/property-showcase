import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,

  plugins: [
    react(),
    tailwindcss(),

    // Runtime error overlay vetëm gjatë development.
    ...(process.env.NODE_ENV !== "production"
      ? [runtimeErrorOverlay()]
      : []),

    // Replit development tools vetëm jashtë production.
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),

          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),

      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },

    dedupe: ["react", "react-dom"],
  },

  root: path.resolve(import.meta.dirname),

  // Pastro debug information në production.
  esbuild: {
    drop: ["debugger"],

    pure:
      process.env.NODE_ENV === "production"
        ? [
            "console.log",
            "console.debug",
            "console.info",
          ]
        : [],
  },

  build: {
    outDir: path.resolve(
      import.meta.dirname,
      "dist/public",
    ),

    emptyOutDir: true,

    // Mos publiko source maps.
    // Kjo pengon rikonstruktimin e lehtë të source code-it origjinal.
    sourcemap: false,

    // Minifiko JavaScript-in e production.
    minify: "esbuild",
  },

  server: {
    port,
    host: "0.0.0.0",

    // E nevojshme për development environment-in aktual.
    allowedHosts: true,

    fs: {
      strict: true,

      // Mos lejo Vite dev server të shërbejë hidden files.
      deny: ["**/.*"],
    },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});