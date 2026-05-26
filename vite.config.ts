// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: /^three$/, replacement: path.resolve(__dirname, "./node_modules/three/build/three.module.js") },
      { find: /^three\/webgpu$/, replacement: path.resolve(__dirname, "./node_modules/three/build/three.webgpu.js") },
      { find: /^three\/examples\/jsm\/(.*)$/, replacement: path.resolve(__dirname, "./node_modules/three/examples/jsm/$1") },
    ],
    dedupe: ["three", "react", "react-dom"],
  },

  // === SOLUCIÓN AL ERROR: Ignorar carpeta api completamente ===
  build: {
    rollupOptions: {
      external: [
        'api/**',
        '**/*.ts',           // Evitar que procese archivos .ts fuera de src
      ],
    },
  },

  optimizeDeps: {
    exclude: ['api', 'api/**']
  },

  // Excluir api del escaneo de dependencias
  ssr: {
    noExternal: ['api/**']
  }
}));
