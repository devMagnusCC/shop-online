import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { loginHandler, authMiddleware } from './middleware/auth.js';
import pool, { initDB, rowToProduto } from './db.js';

// Mantenha sincronizado com src/constants/categorias.js
const CATEGORIAS = [
  'Eletrodomésticos', 'Eletrônicos', 'Livros', 'Limpeza',
  'Moda e Acessórios', 'Cozinha', 'Pet Shop', 'Beleza e Cuidados',
  'Esporte e Lazer', 'Brinquedos', 'Ferramentas', 'Outros',
];

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Security middleware ---
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5174,http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Em produção (Render), o frontend e a API vivem no mesmo domínio (same-origin):
// o navegador não envia header Origin nas chamadas à mesma origem, então o CORS
// não bloqueia. Também aceitamos o próprio host para chamadas cross-origin
// (ex.: domínio definitivo acessado com/sem www).
const PRODUCTION_HOST = IS_PRODUCTION ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'achadinhos-loja.onrender.com'}` : null;
if (PRODUCTION_HOST && !ALLOWED_ORIGINS.includes(PRODUCTION_HOST)) {
  ALLOWED_ORIGINS.push(PRODUCTION_HOST);
}

app.use(cors({
  origin: (origin, cb) => {
    // Sem Origin (curl, server-to-server, mesmo domínio sem header) → aceita
    if (!origin) return cb(null, true);

    // Origem na lista explícita → aceita
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // Qualquer outra origem → bloqueia
    cb(new Error('Origem não permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Static files ---
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Em produção, servir o build do frontend
// Serve sempre que o build existir (funciona em Railway, Render, PM2, local)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir) && fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
  // SPA fallback: qualquer rota não reconhecida serve o index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(publicDir, 'index.html'));
    }
    next();
  });
}

// --- Multer config ---
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const IMAGE_MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46],
};

function validateImageMagic(bytes) {
  return Object.values(IMAGE_MAGIC_BYTES).some((magic) =>
    magic.every((b, i) => bytes[i] === b)
  );
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExt = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i;
  if (!allowedExt.test(path.extname(file.originalname))) {
    return cb(new Error('Formato não suportado. Use imagens (jpg, png, gif, webp, svg) ou vídeos (mp4, webm, mov).'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB para vídeos
});

// Upload para CSV (importação de preços)
const csvStorage = multer.memoryStorage();
const csvUpload = multer({
  storage: csvStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB para CSV
});

// --- Helpers ---
function sanitizeHtml(str) {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isValidUrl(str) {
  return typeof str === 'string' && /^https?:\/\//i.test(str.trim());
}

function isPathSafe(filename) {
  const resolved = path.resolve(UPLOADS_DIR, filename);
  return (
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    resolved.startsWith(UPLOADS_DIR)
  );
}

// Mapa de extensão → Content-Type. Mantenha sincronizado com src/constants/… se aplicável.
// Nomes de arquivo são gerados como "<uuid>.<ext>" (ext minúscula), então o lookup é direto.
const EXT_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

function isVideo(filename) {
  return /\.(mp4|webm|mov)$/i.test(filename);
}

// --- Auth route (com rate limit) ---
app.post('/api/login', loginLimiter, loginHandler);

// --- Product routes (public) ---
app.get('/api/produtos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM produtos ORDER BY created_at ASC');
    res.json({ success: true, data: rows.map(rowToProduto) });
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    res.status(500).json({ error: 'Erro ao carregar produtos' });
  }
});

app.get('/api/produtos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM produtos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    res.json({ success: true, data: rowToProduto(rows[0]) });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// --- Product routes (admin, auth required) ---
app.post('/api/produtos', authMiddleware, async (req, res) => {
  try {
    const { nome, descricao, preco, midias, linkCompra, categoria } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (!linkCompra || !isValidUrl(linkCompra)) {
      return res.status(400).json({ error: 'Link de compra inválido. Deve começar com http:// ou https://' });
    }

    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoria inválida. Categorias disponíveis: ${CATEGORIAS.join(', ')}` });
    }

    const agora = new Date().toISOString();
    const novoProduto = {
      id: uuidv4(),
      nome: sanitizeHtml(nome.trim()),
      descricao: descricao ? sanitizeHtml(descricao.trim()) : '',
      // Preço é informativo/manual e não é mais obrigatório ao cadastrar
      preco: preco !== undefined && preco !== null && !isNaN(Number(preco)) ? parseFloat(preco) : null,
      midias: Array.isArray(midias) ? midias : [],
      categoria: categoria || '',
      linkCompra: linkCompra.trim(),
      createdAt: agora,
      updatedAt: agora,
    };

    const { rows } = await pool.query(
      `INSERT INTO produtos (id, nome, descricao, preco, midias, categoria, link_compra, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        novoProduto.id,
        novoProduto.nome,
        novoProduto.descricao,
        novoProduto.preco,
        novoProduto.midias,
        novoProduto.categoria,
        novoProduto.linkCompra,
        novoProduto.createdAt,
        novoProduto.updatedAt,
      ]
    );

    res.status(201).json({ success: true, data: rowToProduto(rows[0]) });
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/produtos/:id', authMiddleware, async (req, res) => {
  try {
    const { nome, descricao, preco, midias, linkCompra, categoria } = req.body;

    const { rows: existentes } = await pool.query('SELECT * FROM produtos WHERE id = $1', [req.params.id]);
    if (existentes.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (!linkCompra || !isValidUrl(linkCompra)) {
      return res.status(400).json({ error: 'Link de compra inválido. Deve começar com http:// ou https://' });
    }

    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoria inválida. Categorias disponíveis: ${CATEGORIAS.join(', ')}` });
    }

    // Preço opcional ao editar: preserva o valor atual quando não informado
    const precoFinal =
      preco !== undefined && preco !== null && !isNaN(Number(preco))
        ? parseFloat(preco)
        : existentes[0].preco;

    const { rows } = await pool.query(
      `UPDATE produtos
       SET nome = $1, descricao = $2, preco = $3, midias = $4, categoria = $5,
           link_compra = $6, updated_at = $7
       WHERE id = $8
       RETURNING *`,
      [
        sanitizeHtml(nome.trim()),
        descricao ? sanitizeHtml(descricao.trim()) : '',
        precoFinal,
        Array.isArray(midias) ? midias : [],
        categoria || '',
        linkCompra.trim(),
        new Date().toISOString(),
        req.params.id,
      ]
    );

    res.json({ success: true, data: rowToProduto(rows[0]) });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/produtos/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM produtos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = rows[0];
    if (produto.midias && produto.midias.length > 0) {
      // Remove as mídias persistidas no banco e ainda referenciadas pelo produto
      const nomes = produto.midias
        .filter((mediaPath) => mediaPath.startsWith('/api/midia/'))
        .map((mediaPath) => path.basename(mediaPath));
      if (nomes.length > 0) {
        await pool.query('DELETE FROM midias WHERE nome = ANY($1)', [nomes]);
      }
    }

    await pool.query('DELETE FROM produtos WHERE id = $1', [req.params.id]);

    res.json({ success: true, message: 'Produto removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover produto:', err);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

// --- Upload routes ---
app.post('/api/upload', authMiddleware, (req, res, next) => {
  upload.array('midias', 20)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo muito grande. Máximo 50MB.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Muitos arquivos. Máximo 20.' });
        }
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Validar magic bytes apenas para imagens
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!isVideo(file.originalname) && ext !== '.svg') {
          const header = file.buffer.subarray(0, 4);
          if (!validateImageMagic(header)) {
            return res.status(400).json({
              error: `Arquivo "${file.originalname}" não é uma imagem válida`,
            });
          }
        }
      }

      // Persiste cada arquivo no banco (BYTEA) e devolve a URL pública
      const urls = [];
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        const nome = `${uuidv4()}.${ext}`;
        const tipo = EXT_MIME[ext] || 'application/octet-stream';
        await pool.query(
          'INSERT INTO midias (nome, tipo, dados) VALUES ($1, $2, $3)',
          [nome, tipo, file.buffer]
        );
        urls.push(`/api/midia/${nome}`);
      }

      res.json({ success: true, data: urls });
    } catch (err) {
      console.error('Erro ao processar upload:', err);
      res.status(500).json({ error: 'Erro ao fazer upload' });
    }
  });
});

// Serve as mídias persistidas no banco (BYTEA). Rota pública.
// As URLs armazenadas nos produtos são /api/midia/<nome>.
app.get('/api/midia/:nome', async (req, res) => {
  try {
    const { nome } = req.params;

    if (!isPathSafe(nome)) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }

    const { rows } = await pool.query('SELECT dados, tipo FROM midias WHERE nome = $1', [nome]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    const { dados, tipo } = rows[0];
    res.set('Content-Type', tipo || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(dados);
  } catch (err) {
    console.error('Erro ao buscar mídia:', err);
    res.status(500).json({ error: 'Erro ao buscar mídia' });
  }
});

// Remove uma mídia persistida no banco (chamado ao remover do formulário).
app.delete('/api/midia/:nome', authMiddleware, async (req, res) => {
  try {
    const { nome } = req.params;

    if (!isPathSafe(nome)) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }

    await pool.query('DELETE FROM midias WHERE nome = $1', [nome]);

    res.json({ success: true, message: 'Mídia removida' });
  } catch (err) {
    console.error('Erro ao remover mídia:', err);
    res.status(500).json({ error: 'Erro ao remover mídia' });
  }
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  if (err.message === 'Origem não permitida pelo CORS') {
    return res.status(403).json({ error: 'Origem não permitida' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição muito grande' });
  }

  console.error('Erro interno:', IS_PRODUCTION ? err.message : err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log(`CORS permitido para: ${ALLOWED_ORIGINS.join(', ')}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
