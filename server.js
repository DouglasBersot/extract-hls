const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const url = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/opt/render/project/.render/chromium/chrome', // Chromium já instalado no Render
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

    const hls = await page.evaluate(() => {
      try {
        return jwplayer().getPlaylist()[0].file;
      } catch (e) {
        return null;
      }
    });

    await browser.close();

    if (hls && hls.includes('.m3u8')) {
      res.json({ success: true, url: hls });
    } else {
      res.status(404).json({ success: false, error: 'Link .m3u8 não encontrado.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API online usando puppeteer-core e Chrome do sistema.');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
