import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import os from "node:os";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

/** Electron fetch() rejects /@fs/ URLs when the project path contains spaces. */
function encodeAtFsPathSpaces(): Plugin {
  const encode = (code: string): string =>
    code.replace(/\/@fs\/[^"'`\n]+/g, (segment) =>
      segment.includes(" ") ? segment.replace(/ /g, "%20") : segment,
    );

  const patchTransformRequest = (server: ViteDevServer): void => {
    const transformRequest = server.transformRequest.bind(server);
    server.transformRequest = async (url, options) => {
      const result = await transformRequest(url, options);
      if (result?.code?.includes("/@fs/") && result.code.includes(" ")) {
        result.code = encode(result.code);
      }
      return result;
    };
  };

  return {
    name: "encode-at-fs-path-spaces",
    configureServer(server) {
      patchTransformRequest(server);
    },
    configurePreviewServer(server) {
      patchTransformRequest(server as ViteDevServer);
    },
    transform(code) {
      if (!code.includes("/@fs/") || !code.includes(" ")) return null;
      const next = encode(code);
      return next === code ? null : { code: next, map: null };
    },
  };
}

const viteCacheDir = path.join(os.tmpdir(), "tbh-companion-vite-cache");

// electron-vite auto-detects entries:
//   main    -> src/main/index.ts
//   preload -> src/preload/index.ts
//   renderer-> src/renderer/index.html (root: src/renderer)
export default defineConfig({
  main: { build: { sourcemap: false } },
  preload: { build: { sourcemap: false } },
  renderer: {
    cacheDir: viteCacheDir,
    server: {
      fs: {
        allow: [path.resolve(__dirname, ".."), viteCacheDir],
      },
    },
    plugins: [tailwindcss(), react(), encodeAtFsPathSpaces()],
    build: { sourcemap: false },
  },
});
