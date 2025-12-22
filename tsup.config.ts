import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    browser: 'src/browser/index.ts',
    react: 'src/react/index.tsx',
    context: 'src/context/index.ts',
    testing: 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  splitting: true,
  target: 'es2022',
  outDir: 'dist',
  skipNodeModulesBundle: true,
  external: ['react'],
});
