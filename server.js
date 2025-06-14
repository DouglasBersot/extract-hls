const express = require('express');
const puppeteer = require('puppeteer-core'); // usando puppeteer-core
const { executablePath } = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      executablePath: executablePath(),
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ]
    });

    const page = await browser.newPage();

    let tsSegmentUrl = null;

    // Interceptar requisições
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.ts') && url.includes('seg-') && !tsSegmentUrl) {
        tsSegmentUrl = url;
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Clica no botão de play (caso exista)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.play();
    });

    // Aguarda as requisições .ts
    await page.waitForTimeout(5000);

    await browser.close();

    if (tsSegmentUrl) {
      const masterUrl = tsSegmentUrl.replace(/seg-[^/]+\.ts.*/, 'master.m3u8');
      res.json({ success: true, url: masterUrl });
    } else {
      res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API Puppeteer Online - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado em http://localhost:${PORT}`);
});
