import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import got from 'got';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Libera CORS para todas as origens

// 🔎 API que extrai o master.m3u8 de um código
app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    let tsSegmentUrl = null;

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('🎯 Interceptado .ts:', url);
        if (!tsSegmentUrl) tsSegmentUrl = url;
      }
    });

    console.log('🌐 Acessando:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await browser.close();

    if (tsSegmentUrl) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 🔁 Proxy inteligente que repassa .m3u8 ou .ts
app.get('/proxy', async (req, res) => {
  const m3u8Url = req.query.m3u8;
  if (!m3u8Url) return res.status(400).send('URL ausente.');

  try {
    const response = await got.stream(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://c1z39.com/',
      },
    });

    response.on('error', (err) => {
      console.error('Erro ao acessar conteúdo:', err.message);
      res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    response.pipe(res);
  } catch (err) {
    console.error('Erro no proxy:', err.message);
    res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
  }
});

app.get('/', (req, res) => {
  res.send('🟢 API + Proxy online. Use /api/getm3u8/{code} ou /proxy?m3u8=...');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
