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

    console.log('🌐 Abrindo navegador...');
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    console.log('🚀 Navegador aberto');

    const page = await browser.newPage();

    let tsSegmentUrl = null;

    // Interceptar requests de .ts para pegar o segmento
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('📦 Segmento TS interceptado:', url);
        tsSegmentUrl = url;
      }
    });

    console.log('🌐 Acessando URL:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Clicar no vídeo para disparar o player (se existir)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    console.log('✅ Página carregada, aguardando interceptação dos segmentos .ts...');
    await page.waitForTimeout(4000);

    await browser.close();

    if (tsSegmentUrl && tsSegmentUrl.includes('.ts')) {
      // Substitui o segmento .ts por master.m3u8 para reconstruir a URL válida
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído master.m3u8:', masterUrl);
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
