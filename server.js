const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    let tsSegmentUrl = null;

    // Interceptar os requests de .ts
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('📦 Segmento TS interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    // Acessa a página e espera totalmente carregar
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Clica no player (caso necessário)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    // Espera alguns segundos para os .ts aparecerem
    await page.waitForTimeout(4000);

    await browser.close();

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro ao extrair o link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🔍 API Puppeteer Online - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
