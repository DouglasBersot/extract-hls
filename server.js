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
    console.log("✅ Puppeteer iniciado com sucesso!");

    const page = await browser.newPage();
    console.log("📄 Nova página criada.");

    console.log("🌐 Acessando URL:", targetUrl);
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log("✅ Página carregada!");
    } catch (gotoErr) {
      console.error("❌ Erro ao carregar a página:", gotoErr.message);
      await browser.close();
      return res.status(500).json({ success: false, error: "Erro ao carregar página" });
    }

    let tsSegmentUrl = null;

    // Interceptar requests de arquivos .ts
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('📦 Segmento TS interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    // Clica no player (se existir)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.click();
        console.log('▶️ Video clicado para iniciar o stream');
      }
    });

    // Espera 4 segundos para garantir que os .ts carreguem
    await page.waitForTimeout(4000);

    await browser.close();

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      // Troca o segmento .ts pelo master.m3u8
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído URL master.m3u8:', masterUrl);
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
