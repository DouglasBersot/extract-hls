const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log("🔧 Iniciando Puppeteer...");
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(20000); // Evita travamento

    console.log("🌐 Acessando URL:", targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    let tsSegmentUrl = null;

    // Intercepta .ts
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('📦 Segmento TS interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    // Simula clique no player
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    console.log("✅ Página carregada, aguardando .ts...");
    await page.waitForTimeout(4000); // Aguarda .ts aparecer

    await browser.close();

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      console.warn("⚠️ Nenhum segmento .ts encontrado");
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro ao extrair o link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get('/', (req, res) => {
  res.send('🧪 API Puppeteer Online - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
