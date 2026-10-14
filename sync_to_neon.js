const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('[Sync Error] DATABASE_URL environment variable is required.');
  process.exit(1);
}
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

async function sync() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS moonshot_store (
      store_key VARCHAR(64) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  if (fs.existsSync(STORE_PATH)) {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const query = `
      INSERT INTO moonshot_store (store_key, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (store_key)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;
    await client.query(query, ['master_store', data]);
    console.log('[Sync] Successfully uploaded local store to Neon PostgreSQL!');
  }

  const res = await client.query('SELECT store_key, length(data::text) as size_bytes, updated_at FROM moonshot_store;');
  console.log('[Sync] Cloud records in moonshot_db:', res.rows);
  await client.end();
}

sync().catch(err => {
  console.error('[Sync Error]', err);
  process.exit(1);
});
