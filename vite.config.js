import {defineConfig} from 'vite';
// В разработке /api проксируется на сервер стенда (node server/server.mjs), если он запущен; нет сервера — игра работает с локальным топом
export default defineConfig({base:'./',build:{rollupOptions:{input:{main:'index.html',top:'top.html'}}},
 server:{proxy:{'/api':{target:process.env.STAND_API||'http://127.0.0.1:8080',changeOrigin:true}}}});
