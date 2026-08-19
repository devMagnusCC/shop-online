import pg from 'pg';

// Pool de conexões com o PostgreSQL.
// Em produção (Render), a connection string vem da env DATABASE_URL.
// A env é lida por entry.js antes deste import (ver server/entry.js).
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new pg.Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        // Fallback local (sem DATABASE_URL): tenta um Postgres na porta padrão
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'loja',
      }
);

// Cria as tabelas produtos e midias se não existirem.
// Chamado uma vez na subida do servidor (idempotente).
export async function initDB() {
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

  // Blobs de mídia persistidos no banco (imagens/vídeos dos produtos).
  // nome = "<uuid>.<ext>" — mesmo formato do nome de arquivo antigo em /uploads,
  // o que permite migrar os produtos trocando apenas o prefixo da URL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS midias (
      nome       TEXT PRIMARY KEY,
      tipo       TEXT NOT NULL DEFAULT '',
      dados      BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

// Mapeia uma linha do banco para o formato que o frontend espera (camelCase).
export function rowToProduto(row) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    preco: row.preco != null ? Number(row.preco) : null,
    midias: row.midias || [],
    categoria: row.categoria,
    linkCompra: row.link_compra || '',
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

export default pool;