import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('vite').UserConfig} */
export default {
  root: __dirname,
  resolve: {
    alias: {
      '@nextrush/log/react': path.resolve(__dirname, '../../dist/react.js'),
      '@nextrush/log': path.resolve(__dirname, '../../dist/index.js'),
    },
  },
  server: {
    port: 4174,
    strictPort: true,
  },
};
