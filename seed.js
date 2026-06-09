import { openDb, migrate } from './src/db.js';
import { seedCatalog } from './src/data.js';
import fs from 'node:fs';

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/app.sqlite');
migrate(db);
seedCatalog(db);
console.log('Каталог тем и руководителей засеян (если был пуст).');
