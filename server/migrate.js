// Migração: importa os produtos do server/db.json (legado) para o PostgreSQL.
// Uso:  node --env-file=server/.env server/migrate.js
//       DATABASE_URL=... node server/migrate.js
// Idempotente: usar ON CONFLICT DO NOTHING em cada id, então pode rodar mais de uma vez.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new pg.Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'loja' }
);

async function main() {
  const dbPath = path.join(__dirname, 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.log('db.json não encontrado — nada a migrar.');
    return;
  }

  const { produtos = [] } = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Encontrados ${produtos.length} produtos no db.json`);

  if (produtos.length === 0) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS produtos (
      id          TEXT PRIMARY KEY,
      nome        TEXT NOT NULL,
      descricao   TEXT NOT NULL DEFAULT '',
      preco       NUMERIC,
      midias      TEXT[] NOT NULL DEFAULT '{}',
      categoria   TEXT NOT NULL DEFAULT '',
      link_compra TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  let inseridos = 0;
  let ignorados = 0;

  for (const p of produtos) {
    const midias = Array.isArray(p.midias) ? p.midias : Array.isArray(p.imagens) ? p.imagens : [];
    const result = await pool.query(
      `INSERT INTO produtos
         (id, nome, descricao, preco, midias, categoria, link_compra, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.nome,
        p.descricao || '',
        p.preco ?? null,
        midias,
        p.categoria || '',
        p.linkCompra || '',
        p.createdAt || new Date().toISOString(),
        p.updatedAt || new Date().toISOString(),
      ]
    );
    if (result.rowCount > 0) inseridos++;
    else ignorados++;
  }

  console.log(`✅ Migração concluída: ${inseridos} inseridos, ${ignorados} já existiam (ignorados).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});