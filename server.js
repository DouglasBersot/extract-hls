const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');  // ✅ Importa CORS
const got = require('got');    // ✅ Para fazer proxy HTTP

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // ✅ Ativa CORS para todas as origens

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    console.log('🌐 Acessando:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

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

// Rota proxy para master.m3u8 e segmentos .ts
// Use /proxy?url=URL_ENCODED
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL não informada');

  try {
    console.log('🔗 Proxy para:', url);

    const response = await got.stream(url);

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (response.headers['cache-control']) res.setHeader('Cache-Control', response.headers['cache-control']);
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);

    response.pipe(res);

    response.on('error', err => {
      console.error('❌ Erro no proxy:', err.message);
      if (!res.headersSent) res.status(500).send('Erro ao acessar conteúdo');
    });

  } catch (error) {
    console.error('❌ Erro no proxy:', error.message);
    res.status(500).send('Erro ao acessar conteúdo');
  }
});

app.get('/', (req, res) => {
  res.send('API Puppeteer + Proxy Online - Use /api/getm3u8/{code} e /proxy?url=');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
