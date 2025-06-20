// 📦 Módulos
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import got from 'got';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Segurança extra (protege contra ataques HTTP comuns)
app.use(helmet());

// 🌍 CORS
app.use(cors({ origin: '*', methods: ['GET'] }));

// 🚫 Rate Limiting por IP (ajustável conforme demanda)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300,               // Máx 300 req/min por IP
});
app.use(limiter);

// 🧠 Cache em memória
const masterCache = new Map(); // { code: { url, expiresAt } }
const proxyCache = new Map();  // { url: { body, contentType, expiresAt } }

// 🔎 API para extrair master.m3u8
app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const now = Date.now();

  const cached = masterCache.get(code);
  if (cached && cached.expiresAt > now) {
    console.log('✅ Master.m3u8 cache HIT para', code);
    return res.json({ success: true, url: cached.url });
  }

  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    let tsSegmentUrl = null;
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('🎯 Interceptado .ts:', url);
        if (!tsSegmentUrl) tsSegmentUrl = url;
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();

    if (tsSegmentUrl) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      masterCache.set(code, {
        url: masterUrl,
        expiresAt: now + 3 * 60 * 60 * 1000,
      });
      console.log('✅ Reconstruído e salvo em cache:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 🔁 Proxy com cache, reescrita e headers seguros
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.m3u8;
  if (!targetUrl) return res.status(400).send('URL ausente.');
  const now = Date.now();

  const isPlaylist = targetUrl.includes('.m3u8');
  const cacheEntry = proxyCache.get(targetUrl);
  if (cacheEntry && cacheEntry.expiresAt > now) {
    console.log('✅ Proxy cache HIT:', targetUrl);
    res.setHeader('Content-Type', cacheEntry.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cacheEntry.body);
  }

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
    console.error('Erro ao acessar conteúdo:', err.message);
    return res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
  }
});

// 🔰 Rota raiz
app.get('/', (req, res) => {
  res.send('🟢 API + Proxy com cache, segurança e reescrita HLS online. Use /api/getm3u8/{code} ou /proxy?m3u8=...');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
