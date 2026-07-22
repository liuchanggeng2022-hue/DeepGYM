import { cp, readFile, rm, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const companionAssetRoot = resolve(workspaceRoot, "public/companions");

function companionAssets(): Plugin {
  return {
    name: "deepgym-companion-assets",
    configureServer(server) {
      server.middlewares.use("/companions", async (request, response, next) => {
        try {
          const relativePath = decodeURIComponent((request.url || "").split("?")[0]).replace(/^\/+/, "");
          const assetPath = resolve(companionAssetRoot, relativePath);
          if (assetPath !== companionAssetRoot && !assetPath.startsWith(`${companionAssetRoot}${sep}`)) return next();
          if (!(await stat(assetPath)).isFile()) return next();
          const mimeType = extname(assetPath).toLowerCase() === ".webp" ? "image/webp" : "application/octet-stream";
          response.statusCode = 200;
          response.setHeader("Content-Type", mimeType);
          response.setHeader("Cache-Control", "public, max-age=3600");
          response.end(await readFile(assetPath));
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const outputPath = resolve(workspaceRoot, "dist/companions");
      await rm(outputPath, { recursive: true, force: true });
      await cp(companionAssetRoot, outputPath, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), companionAssets()],
  publicDir: "vendor/exercises-dataset",
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
