const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const videoUrl = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Necessário para hospedagens
    });

    const page = await browser.newPage();
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const link = await page.evaluate(() => {
      try {
        return jwplayer().getPlaylist()[0].file;
      } catch (e) {
        return null;
      }
    });

    await browser.close();

    if (link && link.includes(".m3u8")) {
      res.json({ success: true, code, url: link });
    } else {
      res.status(404).json({ success: false, error: 'Link não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API rodando em http://localhost:${PORT}`);
});
