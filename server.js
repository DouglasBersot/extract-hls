const express = require('express');
const cors = require('cors'); // ✅ IMPORTA O CORS
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // ✅ ATIVA O CORS PARA QUALQUER ORIGEM

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  console.log("🔧 Iniciando Puppeteer...");
  console.log("🌐 Acessando:", targetUrl);

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    let tsSegmentUrl = null;

    // Intercepta os segmentos .ts
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.ts') && url.includes('seg-')) {
        tsSegmentUrl = url;
        console.log("🎯 Interceptado .ts:", url);
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Simula clique no vídeo, se necessário
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    // Aguarda um tempo para os .ts serem carregados
    await new Promise(resolve => setTimeout(resolve, 4000));

    await browser.close();

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      const masterUrl = tsSegmentUrl.replace(/\/[^\/]+\.ts.*/, '/master.m3u8');
      console.log("✅ Reconstruído:", masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }

  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🎥 API de Extração M3U8 - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando localmente: http://localhost:${PORT}`);
});
