const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Libera CORS para todas as rotas

// API para extrair link master.m3u8 válido
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

    // Espera 5 segundos para os segmentos .ts começarem a carregar
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

// Proxy para qualquer URL (m3u8, ts, etc) para evitar CORS e IP binding
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('Parâmetro "url" é obrigatório');
  }

  try {
    console.log('🌐 Proxy para URL:', url);

    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*',
        'Referer': 'https://c1z39.com/', // importante para evitar bloqueios
      },
      timeout: 15000,
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.data.pipe(res);
  } catch (error) {
    console.error('❌ Erro no proxy:', error.message);
    res.status(500).send('Erro ao acessar conteúdo proxy');
  }
});

app.get('/', (req, res) => {
  res.send('API Puppeteer + Proxy rodando. Use /api/getm3u8/{code} e /proxy?url=URL_DO_RECURSO');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
