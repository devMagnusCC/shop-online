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
import { verificarPreco } from './services/precoScraper.js';

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
  .map((s) => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Origem não permitida pelo CORS'));
    }
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
if (IS_PRODUCTION) {
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // SPA fallback: qualquer rota não reconhecida serve o index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }
}

// --- DB helpers ---
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { produtos: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

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

function isVideo(filename) {
  return /\.(mp4|webm|mov)$/i.test(filename);
}

// --- Auth route (com rate limit) ---
app.post('/api/login', loginLimiter, loginHandler);

// --- Product routes (public) ---
app.get('/api/produtos', (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, data: db.produtos });
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    res.status(500).json({ error: 'Erro ao carregar produtos' });
  }
});

// --- Price check route (must come BEFORE /api/produtos/:id) ---
app.get('/api/produtos/:id/preco', authMiddleware, async (req, res) => {
  try {
    const db = readDB();
    const produto = db.produtos.find((p) => p.id === req.params.id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    if (!produto.linkCompra) {
      return res.status(400).json({ error: 'Produto não possui link de compra' });
    }

    const resultado = await verificarPreco(produto.linkCompra);

    if (!resultado.suportada) {
      return res.json({
        success: true,
        data: {
          precoAtual: produto.preco,
          linkCompra: produto.linkCompra,
          suportada: false,
          loja: resultado.loja || null,
          mensagem: resultado.mensagem || 'Não foi possível verificar preço para esta loja.',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        precoAtual: produto.preco,
        linkCompra: produto.linkCompra,
        suportada: true,
        loja: resultado.loja,
        lojaId: resultado.lojaId,
        precoSugerido: resultado.precoSugerido,
        moeda: resultado.moeda,
        mensagem: resultado.mensagem,
      },
    });
  } catch (err) {
    console.error('Erro ao verificar preço:', err);
    res.status(500).json({ error: 'Erro ao verificar preço' });
  }
});

app.get('/api/produtos/:id', (req, res) => {
  try {
    const db = readDB();
    const produto = db.produtos.find((p) => p.id === req.params.id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    res.json({ success: true, data: produto });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// --- Product routes (admin, auth required) ---
app.post('/api/produtos', authMiddleware, (req, res) => {
  try {
    const { nome, descricao, preco, midias, linkCompra, categoria } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (preco === undefined || preco === null || isNaN(Number(preco)) || Number(preco) < 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }

    if (!linkCompra || !isValidUrl(linkCompra)) {
      return res.status(400).json({ error: 'Link de compra inválido. Deve começar com http:// ou https://' });
    }

    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoria inválida. Categorias disponíveis: ${CATEGORIAS.join(', ')}` });
    }

    const db = readDB();
    const novoProduto = {
      id: uuidv4(),
      nome: sanitizeHtml(nome.trim()),
      descricao: descricao ? sanitizeHtml(descricao.trim()) : '',
      preco: parseFloat(preco),
      midias: Array.isArray(midias) ? midias : [],
      categoria: categoria || '',
      linkCompra: linkCompra.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.produtos.push(novoProduto);
    writeDB(db);

    res.status(201).json({ success: true, data: novoProduto });
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/produtos/:id', authMiddleware, (req, res) => {
  try {
    const { nome, descricao, preco, midias, linkCompra, categoria } = req.body;
    const db = readDB();
    const index = db.produtos.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (preco === undefined || preco === null || isNaN(Number(preco)) || Number(preco) < 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }

    if (!linkCompra || !isValidUrl(linkCompra)) {
      return res.status(400).json({ error: 'Link de compra inválido. Deve começar com http:// ou https://' });
    }

    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoria inválida. Categorias disponíveis: ${CATEGORIAS.join(', ')}` });
    }

    db.produtos[index] = {
      ...db.produtos[index],
      nome: sanitizeHtml(nome.trim()),
      descricao: descricao ? sanitizeHtml(descricao.trim()) : '',
      preco: parseFloat(preco),
      midias: Array.isArray(midias) ? midias : [],
      categoria: categoria || '',
      linkCompra: linkCompra.trim(),
      updatedAt: new Date().toISOString(),
    };

    writeDB(db);
    res.json({ success: true, data: db.produtos[index] });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/produtos/:id', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const index = db.produtos.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = db.produtos[index];
    if (produto.midias && produto.midias.length > 0) {
      produto.midias.forEach((mediaPath) => {
        const filename = path.basename(mediaPath);
        if (isPathSafe(filename)) {
          const fullPath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      });
    }

    db.produtos.splice(index, 1);
    writeDB(db);

    res.json({ success: true, message: 'Produto removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover produto:', err);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

// --- Upload routes ---
app.post('/api/upload', authMiddleware, (req, res, next) => {
  upload.array('midias', 20)(req, res, (err) => {
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
          const buf = fs.readFileSync(file.path);
          const header = buf.subarray(0, 4);
          if (!validateImageMagic(header)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({
              error: `Arquivo "${file.originalname}" não é uma imagem válida`,
            });
          }
        }
      }

      const paths = req.files.map((file) => `/uploads/${file.filename}`);
      res.json({ success: true, data: paths });
    } catch (err) {
      console.error('Erro ao processar upload:', err);
      res.status(500).json({ error: 'Erro ao fazer upload' });
    }
  });
});

app.delete('/api/upload/:filename', authMiddleware, (req, res) => {
  try {
    const { filename } = req.params;

    if (!isPathSafe(filename)) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }

    const fullPath = path.join(UPLOADS_DIR, filename);

    if (!fullPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Caminho de arquivo inválido' });
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ success: true, message: 'Arquivo removido' });
  } catch (err) {
    console.error('Erro ao remover arquivo:', err);
    res.status(500).json({ error: 'Erro ao remover arquivo' });
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

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`CORS permitido para: ${ALLOWED_ORIGINS.join(', ')}`);
});
