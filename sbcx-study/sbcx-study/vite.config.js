import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

// 로컬 개발(npm run dev)에서도 /api/* 를 Vercel 함수처럼 실행한다.
// APPS_SCRIPT_URL이 없으면 구글 시트 대신 .data/local-sheets.json에 저장된다.
function localApi() {
  return {
    name: 'sbcx-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '/';
        if (url === '/admin' || url.startsWith('/admin?') || url === '/admin/') {
          req.url = '/admin.html' + (url.includes('?') ? url.slice(url.indexOf('?')) : '');
          return next();
        }
        if (!url.startsWith('/api/')) return next();
        const route = url.split('?')[0].replace(/\/$/, '');
        if (!/^\/api\/[a-z/]+$/.test(route)) return next();
        try {
          const mod = await server.ssrLoadModule(path.join(root, route + '.js'));
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: '없는 API예요: ' + route + ' (' + e.message + ')' }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // .env.local 에 넣은 값을 로컬 /api 에서도 쓰게 한다 (Vercel에서는 대시보드의 환경 변수를 씀)
  const env = loadEnv(mode, root, '');
  ['APPS_SCRIPT_URL', 'APPS_SCRIPT_SECRET', 'ADMIN_PASSWORD', 'SESSION_SECRET'].forEach((k) => {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  });
  return {
  plugins: [react(), localApi()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: path.join(root, 'index.html'),
        admin: path.join(root, 'admin.html')
      }
    }
  }
  };
});
