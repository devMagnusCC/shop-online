import axios from 'axios';
import https from 'https';

const AGENT = new https.Agent({ keepAlive: true });

// ─── Identificação de loja ────────────────────────────────────────

function identificarLoja(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('mercadolivre') || hostname.includes('mercadolibre')) {
      return 'mercadolivre';
    }
    if (hostname.includes('amazon')) {
      return 'amazon';
    }
    if (hostname.includes('shopee')) {
      return 'shopee';
    }
  } catch {
    // URL inválida
  }
  return null;
}

// ─── Extração de IDs por loja ─────────────────────────────────────

function extrairASIN(url) {
  if (!url) return null;

  // /dp/XXXXXXXXXX
  const match1 = url.match(/\/dp\/([A-Z0-9]{10})(?:\?|$|\/)/);
  if (match1) return match1[1];

  // /-/dp/XXXXXXXXXX
  const match2 = url.match(/\/-\/dp\/([A-Z0-9]{10})/);
  if (match2) return match2[1];

  // /gp/product/XXXXXXXXXX
  const match3 = url.match(/\/gp\/product\/([A-Z0-9]{10})/);
  if (match3) return match3[1];

  // ASIN no path ou query
  const match4 = url.match(/[?&]asin=([A-Z0-9]{10})/);
  if (match4) return match4[1];

  return null;
}

function extrairShopeeId(url) {
  if (!url) return null;

  // /product/XXXXX/XXXXXXX/ ou /produto/XXXXX/XXXXXXX/
  const match1 = url.match(/\/[a-z]+\/(\d+)\/(\d+)/);
  if (match1) return { shopId: match1[1], itemId: match1[2] };

  // i.XXXXXX.XXXXXXX
  const match2 = url.match(/i\.(\d+)\.(\d+)/);
  if (match2) return { shopId: match2[1], itemId: match2[2] };

  return null;
}

function extrairMlbId(url) {
  if (!url) return null;

  const match1 = url.match(/\/p\/(MLB\d{8,11})(?:\?|$|\/)/);
  if (match1) return match1[1];

  const match2 = url.match(/\/MLB-(\d{8,11})/);
  if (match2) return `MLB${match2[1]}`;

  const match3 = url.match(/[?&]item_id=(MLB\d{8,11})/);
  if (match3) return match3[1];

  const match4 = url.match(/matt_product_id=(MLB\d{8,11})/);
  if (match4) return match4[1];

  const match5 = url.match(/(MLB\d{8,11})/);
  if (match5) return match5[1];

  return null;
}

// ─── Scraping de páginas ─────────────────────────────────────────

function scrapeJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extrairPrecoDoJsonLd(html) {
  const jsonLd = scrapeJsonLd(html);
  if (!jsonLd) return null;

  // Objeto único
  if (jsonLd.offers?.price) {
    return { preco: parseFloat(jsonLd.offers.price), moeda: jsonLd.offers.priceCurrency || 'BRL' };
  }
  // @graph (Array de itens)
  if (Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      if (item.offers?.price) {
        return { preco: parseFloat(item.offers.price), moeda: item.offers.priceCurrency || 'BRL' };
      }
    }
  }

  return null;
}

async function buscarPrecoScrapingGenerico(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 12000,
        rejectUnauthorized: false,
      },
      (res) => {
        let html = '';
        // Seguir redirects manualmente (1 nível)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          https.get(res.headers.location, { headers: req.options?.headers, timeout: 12000 }, (res2) => {
            let h2 = '';
            res2.on('data', (c) => (h2 += c));
            res2.on('end', () => resolve(extrairPrecoDoHtml(h2)));
          }).on('error', () => resolve(null));
          return;
        }
        res.on('data', (chunk) => (html += chunk));
        res.on('end', () => resolve(extrairPrecoDoHtml(html)));
      }
    );
    req.on('error', () => resolve(null));
    req.end();
  });
}

function extrairPrecoDoHtml(html) {
  // 1. JSON-LD (estruturado)
  const jsonLd = extrairPrecoDoJsonLd(html);
  if (jsonLd) return jsonLd;

  // 2. Meta tags padrão
  const metaMatch = html.match(/itemprop="price"[^>]+content="([^"]+)"/);
  if (metaMatch) return { preco: parseFloat(metaMatch[1]), moeda: 'BRL' };

  const metaPropMatch = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"/);
  if (metaPropMatch) return { preco: parseFloat(metaPropMatch[1]), moeda: 'BRL' };

  // 3. Amazon: #priceblock ou .a-price
  const amzPrice = html.match(/#priceblock_ourprice["'][^>]*>([^<]+)</);
  if (amzPrice) {
    const val = amzPrice[1].replace(/[^0-9,.]/g, '').replace(',', '.');
    const num = parseFloat(val);
    if (!isNaN(num)) return { preco: num, moeda: 'BRL' };
  }

  const amzWhole = html.match(/class="a-price-whole"[^>]*>([^<]+)</);
  const amzFrac = html.match(/class="a-price-fraction"[^>]*>([^<]+)</);
  if (amzWhole) {
    const val = amzWhole[1].replace(/[^0-9]/g, '') + '.' + (amzFrac ? amzFrac[1].replace(/[^0-9]/g, '') : '00');
    return { preco: parseFloat(val), moeda: 'BRL' };
  }

  // 4. ML: andes-money-amount
  const andes = html.match(/andes-money-amount__fraction[^>]*>([^<]+)</);
  if (andes) {
    const val = andes[1].replace(/\./g, '').replace(',', '.');
    return { preco: parseFloat(val), moeda: 'BRL' };
  }

  // 5. Shopee: dados em script __NEXT_DATA__ ou preloaded state
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const nd = JSON.parse(nextData[1]);
      const price = nd?.props?.pageProps?.data?.price || nd?.props?.pageProps?.product?.price;
      if (price) return { preco: parseFloat(price), moeda: 'BRL' };
    } catch {}
  }

  // 6. Preloaded state genérico
  const stateMatch = html.match(/"price"[^:]*:\s*([\d.]+)/);
  if (stateMatch) return { preco: parseFloat(stateMatch[1]), moeda: 'BRL' };

  return null;
}

// ─── Consulta à API oficial do Mercado Livre ─────────────────────

async function buscarPrecoMLAPI(mlbId) {
  try {
    const response = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, {
      timeout: 8000,
      httpsAgent: AGENT,
      headers: { 'User-Agent': 'axios/1.18.1', Accept: 'application/json' },
    });
    const { price, currency_id } = response.data;
    if (price != null) return { preco: price, moeda: currency_id || 'BRL' };
  } catch {
    // fallback pro scraping
  }
  return null;
}

// ─── Função principal exportada ──────────────────────────────────

export async function verificarPreco(linkCompra) {
  if (!linkCompra) {
    return { suportada: false, mensagem: 'Link de compra não informado.' };
  }

  const loja = identificarLoja(linkCompra);

  if (!loja) {
    return { suportada: false, mensagem: 'Link de loja não reconhecida. Verificação automática disponível para Mercado Livre, Amazon e Shopee.' };
  }

  // ─── MERCADO LIVRE ────────────────────────────────────────────
  if (loja === 'mercadolivre') {
    const mlbId = extrairMlbId(linkCompra);
    if (!mlbId) {
      return { suportada: true, loja, lojaId: null, precoSugerido: null, moeda: null, mensagem: 'Não foi possível identificar o produto no link do Mercado Livre.' };
    }

    let resultado = await buscarPrecoMLAPI(mlbId);
    if (!resultado) resultado = await buscarPrecoScrapingGenerico(`https://www.mercadolivre.com.br/p/${mlbId}`);

    if (!resultado) return { suportada: true, loja, lojaId: mlbId, precoSugerido: null, moeda: null, mensagem: null };

    return { suportada: true, loja, lojaId: mlbId, precoSugerido: resultado.preco, moeda: resultado.moeda, mensagem: null };
  }

  // ─── AMAZON ───────────────────────────────────────────────────
  if (loja === 'amazon') {
    const asin = extrairASIN(linkCompra);
    if (!asin) {
      return { suportada: true, loja, lojaId: null, precoSugerido: null, moeda: null, mensagem: 'Não foi possível identificar o produto no link da Amazon.' };
    }

    let resultado = await buscarPrecoScrapingGenerico(linkCompra);
    if (!resultado && linkCompra.includes('/dp/')) {
      // Tentar URL limpa sem parâmetros
      const baseUrl = linkCompra.match(/https?:\/\/[^/]+\/dp\/[A-Z0-9]{10}/);
      if (baseUrl) resultado = await buscarPrecoScrapingGenerico(baseUrl[0]);
    }

    if (!resultado) return { suportada: true, loja, lojaId: asin, precoSugerido: null, moeda: null, mensagem: null };

    return { suportada: true, loja, lojaId: asin, precoSugerido: resultado.preco, moeda: resultado.moeda, mensagem: null };
  }

  // ─── SHOPEE ───────────────────────────────────────────────────
  if (loja === 'shopee') {
    const ids = extrairShopeeId(linkCompra);
    if (!ids) {
      return { suportada: true, loja, lojaId: null, precoSugerido: null, moeda: null, mensagem: 'Não foi possível identificar o produto no link da Shopee.' };
    }

    // Shopee renderiza quase tudo via JS — scraping server-side raramente funciona
    // Tenta mesmo assim, mas já avisa que pode falhar
    const resultado = await buscarPrecoScrapingGenerico(linkCompra);

    if (!resultado) {
      return {
        suportada: true,
        loja,
        lojaId: `${ids.shopId}_${ids.itemId}`,
        precoSugerido: null,
        moeda: null,
        mensagem: 'Shopee requer JavaScript para exibir preços. Abra o link para verificar manualmente.',
      };
    }

    return { suportada: true, loja, lojaId: `${ids.shopId}_${ids.itemId}`, precoSugerido: resultado.preco, moeda: resultado.moeda, mensagem: null };
  }

  return { suportada: false, mensagem: 'Loja não reconhecida.' };
}
