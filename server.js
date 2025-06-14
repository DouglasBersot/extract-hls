const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Iniciando Puppeteer...');

    const executablePath = await chromium.executablePath();
    console.log('🔍 Caminho do Chromium:', executablePath);

    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    console.log('🌐 Navegador aberto');

    const page = await browser.newPage();
    console.log('📄 Página criada');

    console.log('🌐 Acessando URL:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Página carregada');

    let tsSegmentUrl = null;

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('📦 Segmento TS interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    // Clica no player (caso necessário)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        console.log('▶️ Clicando no vídeo para iniciar');
        video.click();
      }
    });

    console.log('⏳ Aguardando segmentos .ts aparecerem...');
    await page.waitForTimeout(5000);

    await browser.close();
    console.log('🛑 Navegador fechado');

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ URL reconstruída do master.m3u8:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro ao extrair o link:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🔍 API Puppeteer Online - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
