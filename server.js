const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const url = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });

    const page = await browser.newPage();

    let finalHLS = null;

    // Intercepta todas as requisições de rede e filtra por .m3u8
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') && url.includes('master')) {
        finalHLS = url;
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Espera o player carregar e executa play
    await page.waitForFunction(() => typeof jwplayer === 'function', { timeout: 10000 });

    await page.evaluate(() => {
      try {
        const player = jwplayer();
        player.play();
      } catch (e) {}
    });

    // Aguarda um tempo para o player fazer as requisições
    await page.waitForTimeout(5000);

    await browser.close();

    if (finalHLS) {
      res.json({ success: true, url: finalHLS });
    } else {
      res.status(404).json({ success: false, error: 'Link não encontrado na rede' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('API Puppeteer Online - Use /api/getm3u8/{file_code}');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado em http://localhost:${PORT}`);
});
