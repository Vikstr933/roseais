import { defineConfig, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import type { IncomingMessage, ServerResponse } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom plugin to ensure Cross-Origin Isolation headers for WebContainer
// Using credentialless mode to allow both WebContainer AND external APIs (Google Maps)
function crossOriginIsolation() {
  return {
    name: 'cross-origin-isolation',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((_req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Use credentialless mode - allows external APIs without CORP headers
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
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
  envDir: path.resolve(__dirname), // Look for .env in project root, not client folder
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,

    // Simplified build configuration to fix module loading issues
    rollupOptions: {
      output: {
        // Let Vite handle chunking automatically
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split('.');
          const extType = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name!)) {
            return `images/[name]-[hash].${extType}`;
          }
          if (/\.(css)$/i.test(assetInfo.name!)) {
            return `css/[name]-[hash].${extType}`;
          }
          return `assets/[name]-[hash].${extType}`;
        }
      }
    },

    // Use terser for better compatibility
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    },

    // Increase chunk size limit
    chunkSizeWarningLimit: 2000,

    // Source maps disabled for production
    sourcemap: false,

    // CSS code splitting
    cssCodeSplit: true
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
