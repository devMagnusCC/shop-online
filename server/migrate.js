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

// Cria as tabelas se não existirem. Chamado antes de qualquer passo, mesmo
// quando não há db.json (o backfill de mídias e a reescrita de URLs ainda rodam).
async function criarTabelas() {
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS midias (
      nome       TEXT PRIMARY KEY,
      tipo       TEXT NOT NULL DEFAULT '',
      dados      BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function importarDbJson() {
  const dbPath = path.join(__dirname, 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.log('db.json não encontrado — nada a importar.');
    return;
  }

  const { produtos = [] } = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Encontrados ${produtos.length} produtos no db.json`);

  if (produtos.length === 0) return;

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

  console.log(`✅ Produtos: ${inseridos} inseridos, ${ignorados} já existiam (ignorados).`);
}

// Persiste para o banco os arquivos presentes em uploads/ (se houver).
// Idempotente: ON CONFLICT DO NOTHING por nome.
// Motivação: antes do BYTEA as imagens viviam no disco efêmero do servidor e
// sumiam em redeploy; agora vivem no Postgres. Este backfill garante que os
// arquivos ainda presentes no clone (commitados em git) sejam salvos no banco.
async function backfillMidias() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) return;

  const EXT_MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  };
  const isMidiaSegura = (nome) =>
    !nome.includes('..') && !nome.includes('/') && !nome.includes('\\');

  const arquivos = fs.readdirSync(uploadsDir).filter(isMidiaSegura);
  let gravados = 0;

  for (const nome of arquivos) {
    const dados = fs.readFileSync(path.join(uploadsDir, nome));
    const ext = path.extname(nome).toLowerCase().replace('.', '');
    const tipo = EXT_MIME[ext] || 'application/octet-stream';
    const result = await pool.query(
      'INSERT INTO midias (nome, tipo, dados) VALUES ($1, $2, $3) ON CONFLICT (nome) DO NOTHING',
      [nome, tipo, dados]
    );
    if (result.rowCount > 0) gravados++;
  }

  if (arquivos.length > 0) {
    console.log(`✅ Mídias: ${gravados} gravados no banco, ${arquivos.length - gravados} já existiam.`);
  }
}

// Reescreve as URLs de mídia dos produtos: "/uploads/<nome>" → "/api/midia/<nome>".
// Usa array_agg(... ORDER BY ord) no SQL para preservar a ordem do array.
// Idempotente: só processa produtos que ainda tenham o prefixo antigo.
async function reescreverUrlsMidias() {
  const { rows } = await pool.query(`
    UPDATE produtos
    SET midias = (
      SELECT array_agg(
        CASE WHEN m LIKE '/uploads/%' THEN '/api/midia/' || substring(m FROM length('/uploads/') + 1)
             ELSE m
        END
        ORDER BY ord
      )
      FROM unnest(midias) WITH ORDINALITY AS t(m, ord)
    )
    WHERE EXISTS (SELECT 1 FROM unnest(midias) AS m2 WHERE m2 LIKE '/uploads/%')
    RETURNING id
  `);

  if (rows.length > 0) {
    console.log(`✅ URLs de mídia reescritas em ${rows.length} produto(s) (/uploads/ → /api/midia/).`);
  }
}

criarTabelas()
  .then(importarDbJson)
  .then(backfillMidias)
  .then(reescreverUrlsMidias)
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error('Erro na migração:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });