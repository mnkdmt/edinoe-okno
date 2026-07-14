import fs from 'node:fs';
import { openDb, migrate } from './src/db.js';
import { seedCatalog } from './src/data.js';
import { createApp } from './src/server.js';
import { buildTransportFromEnv, createMailer } from './src/mailer.js';

// Подхватить .env, если есть (без внешних зависимостей, Node 20.6+).
try { process.loadEnvFile('.env'); } catch { /* .env необязателен */ }

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/app.sqlite');
migrate(db);
seedCatalog(db);

const transport = buildTransportFromEnv(process.env);
const mailer = createMailer({ transport, from: process.env.SMTP_FROM || process.env.SMTP_USER });

const config = {
  port: Number(process.env.PORT || 3000),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-insecure-secret-change-me',
  mailer,
};

if (config.adminPassword === 'admin' || config.cookieSecret.startsWith('dev-insecure'))
  console.warn('⚠  Заданы значения по умолчанию. Перед запуском в проде задайте ADMIN_PASSWORD и COOKIE_SECRET.');
if (!transport)
  console.warn('✉  SMTP не настроен — письма-подтверждения не уходят (пишутся в лог). См. .env.example.');

const app = createApp(db, config);
app.listen(config.port, () => console.log(`Сервер запущен: http://localhost:${config.port}`));
