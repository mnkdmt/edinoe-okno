import fs from 'node:fs';
import { openDb, migrate } from './src/db.js';
import { seedCatalog } from './src/data.js';
import { createApp } from './src/server.js';

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/app.sqlite');
migrate(db);
seedCatalog(db);

const config = {
  port: Number(process.env.PORT || 3000),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-insecure-secret-change-me',
};

if (config.adminPassword === 'admin' || config.cookieSecret.startsWith('dev-insecure'))
  console.warn('⚠  Заданы значения по умолчанию. Перед запуском в проде задайте ADMIN_PASSWORD и COOKIE_SECRET.');

const app = createApp(db, config);
app.listen(config.port, () => console.log(`Сервер запущен: http://localhost:${config.port}`));
