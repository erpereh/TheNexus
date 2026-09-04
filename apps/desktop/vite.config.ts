import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed dev port; fail instead of silently shifting ports.
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Rust build artifacts churn while cargo compiles; watching them
      // crashes the dev server with EBUSY on Windows.
      ignored: ['**/src-tauri/**'],
    },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
