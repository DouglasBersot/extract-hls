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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Garante que o jwplayer está pronto
    await page.waitForFunction(() => {
      return typeof jwplayer === 'function' &&
             jwplayer().getPlaylist &&
             jwplayer().getPlaylist().length > 0;
    }, { timeout: 10000 });

    // Toca o vídeo e espera o evento 'play' antes de capturar a URL
    const hls = await page.evaluate(() => {
      return new Promise(resolve => {
        try {
          const player = jwplayer();
          player.on('play', () => {
            setTimeout(() => {
              resolve(player.getPlaylist()[0].file);
            }, 500); // pequeno delay extra para garantir que token foi gerado
          });
          player.play();
        } catch (e) {
          resolve(null);
        }
      });
    });

    await browser.close();

    if (hls && hls.includes('.m3u8')) {
      res.json({ success: true, url: hls });
    } else {
      res.status(404).json({ success: false, error: 'Link não encontrado ou player não respondeu' });
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
