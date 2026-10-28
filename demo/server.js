import {createDemoApp} from './app.js';
if(process.env.NODE_ENV==='production')throw new Error('Demo is disabled in production. Use npm start.');
const port=Number(process.env.DEMO_PORT||3100);
createDemoApp().listen(port,'127.0.0.1',()=>console.info(`Klikchart DEMO: http://127.0.0.1:${port}\nData contoh di memori; reset saat server dimulai ulang. Tidak mengirim OTP atau transaksi nyata.`));
