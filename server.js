import 'dotenv/config';
import app from './backend/app.js';
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.info(`Klikchart lokal: http://localhost:${port}`));
