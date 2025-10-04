import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom plugin to ensure Cross-Origin Isolation headers for WebContainer
function crossOriginIsolation() {
  return {
    name: 'cross-origin-isolation',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin(), crossOriginIsolation()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@db": path.resolve(__dirname, "db"),
      "@lib": path.resolve(__dirname, "client", "src", "lib"),
      "@hooks": path.resolve(__dirname, "client", "src", "hooks"),
      "@components": path.resolve(__dirname, "client", "src", "components"),
    },
  },
  optimizeDeps: {
    exclude: ['@monaco-editor/react'],
    include: ['react', 'react-dom'],
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: false,
      allow: ['..'],
    },
  },
});
