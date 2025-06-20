// 📦 Módulos
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import got from 'got';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // ✅ Importante para funcionar o rate-limit corretamente

// 🛡️ Segurança HTTP
app.use(helmet());

// 🌍 CORS somente para seu domínio
app.use(cors({
  origin: ['https://playflixtv.online'],
  methods: ['GET'],
}));

// 🚫 Rate Limiting por IP (300 req/min)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
});
app.use(limiter);

// 🗜️ Compressão GZIP
app.use(compression());

// 🤖 Bloqueio de crawlers
app.use((req, res, next) => {
  const ua = req.get('User-Agent') || '';
  const blockList = ['curl', 'wget', 'python', 'bot', 'spider', 'scrapy'];
  if (blockList.some(b => ua.toLowerCase().includes(b))) {
    return res.status(403).send('Acesso negado.');
  }
  next();
});

// 📊 Estatísticas
const stats = {
  totalRequests: 0,
  apiHits: 0,
  proxyHits: 0,
  cacheHits: 0,
  cacheMisses: 0,
  uniqueIPs: new Set(),
  errors: [],
};

app.use((req, res, next) => {
  stats.totalRequests++;
  stats.uniqueIPs.add(req.ip);

  if (req.path.startsWith('/api/getm3u8')) stats.apiHits++;
  else if (req.path.startsWith('/proxy')) stats.proxyHits++;

  next();
});

// 🧠 Cache
const masterCache = new Map();
const proxyCache = new Map();

// 🔍 Extrai master.m3u8
app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const now = Date.now();

  const cached = masterCache.get(code);
  if (cached && cached.expiresAt > now) {
    stats.cacheHits++;
    console.log('✅ Master.m3u8 cache HIT para', code);
    return res.json({ success: true, url: cached.url });
  }

  stats.cacheMisses++;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Puppeteer iniciando...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    let tsSegmentUrl = null;

    page.on('request', req => {
      const url = req.url();
      if (url.includes('.ts') && !tsSegmentUrl) {
        console.log('🎯 .ts interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    await new Promise(r => setTimeout(r, 5000));
    await browser.close();

    if (tsSegmentUrl) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      masterCache.set(code, {
        url: masterUrl,
        expiresAt: now + 3 * 60 * 60 * 1000,
      });
      console.log('✅ Reconstruído e cacheado:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (err) {
    console.error('❌ Erro:', err);
    stats.errors.push(err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 🔁 Proxy com cache e reescrita
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.m3u8;
  if (!targetUrl) return res.status(400).send('URL ausente.');
  const now = Date.now();

  const isPlaylist = targetUrl.includes('.m3u8');
  const cache = proxyCache.get(targetUrl);
  if (cache && cache.expiresAt > now) {
    stats.cacheHits++;
    console.log('✅ Proxy cache HIT:', targetUrl);
    res.setHeader('Content-Type', cache.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cache.body);
  }

  stats.cacheMisses++;

  try {
    const response = await got(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://c1z39.com/',
      },
      timeout: { request: 30000 },
      responseType: isPlaylist ? 'text' : 'buffer',
    });

    if (isPlaylist) {
      let content = response.body;
      const base = new URL(targetUrl);
      base.pathname = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

      content = content.replace(/URI="([^"]+)"/g, (match, url) => {
        const absolute = url.startsWith('http') ? url : new URL(url, base).href;
        return `URI="https://${req.get('host')}/proxy?m3u8=${encodeURIComponent(absolute)}"`;
      });

      content = content.replace(/^(?!#)(.*\.(ts|m3u8)(\?.*)?)$/gm, match => {
        const absolute = match.startsWith('http') ? match : new URL(match, base).href;
        return `https://${req.get('host')}/proxy?m3u8=${encodeURIComponent(absolute)}`;
      });

      proxyCache.set(targetUrl, {
        body: content,
        contentType: 'application/vnd.apple.mpegurl',
        expiresAt: now + 3 * 60 * 60 * 1000,
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(content);
    } else {
      proxyCache.set(targetUrl, {
        body: response.body,
        contentType: response.headers['content-type'] || 'application/octet-stream',
        expiresAt: now + 3 * 60 * 60 * 1000,
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(response.body);
    }
  } catch (err) {
    console.error('Erro no proxy:', err.message);
    stats.errors.push(err.message);
    return res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
  }
});

// 📊 Dashboard visual
app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Dashboard</title>
    <style>
      body { background: #111; color: #eee; font-family: sans-serif; padding: 20px; }
      h1 { color: #0f0; }
      table { width: 100%; margin-top: 20px; border-collapse: collapse; }
      td, th { border: 1px solid #333; padding: 8px; text-align: left; }
      .error { color: #f33; }
    </style>
  </head>
  <body>
    <h1>📊 Estatísticas da API</h1>
    <ul>
      <li>📈 Total de requisições: <strong>${stats.totalRequests}</strong></li>
      <li>🧑‍💻 IPs únicos: <strong>${stats.uniqueIPs.size}</strong></li>
      <li>🎯 /api/getm3u8: <strong>${stats.apiHits}</strong></li>
      <li>🔁 /proxy: <strong>${stats.proxyHits}</strong></li>
      <li>🟢 Cache HITs: <strong>${stats.cacheHits}</strong></li>
      <li>🔴 Cache MISSes: <strong>${stats.cacheMisses}</strong></li>
    </ul>
    <h2>🧯 Últimos erros</h2>
    <ul class="error">
      ${stats.errors.slice(-10).map(e => `<li>${e}</li>`).join('') || '<li>Sem erros</li>'}
    </ul>
  </body>
  </html>`);
});

// 🔰 Página padrão
app.get('/', (req, res) => {
  res.send('🟢 API + Proxy com cache, segurança e reescrita HLS ativa. Use /api/getm3u8/{code} ou /proxy?m3u8=...');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
