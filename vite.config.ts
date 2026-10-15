import { defineConfig } from 'vite';

// base './' : 사내 웹서버 하위 경로나 정적 폴더에 그대로 올려도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
