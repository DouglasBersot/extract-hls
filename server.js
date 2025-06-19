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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Espera até que o jwplayer esteja definido
    await page.waitForFunction(() => typeof jwplayer !== 'undefined', { timeout: 10000 });

    // Dá play no player
    await page.evaluate(() => {
      try {
        jwplayer().play();
      } catch (e) {}
    });

    // Espera mais um pouco para o token .m3u8 ser atualizado
    await page.waitForTimeout(4000);

    // Extrai o .m3u8 atualizado
    const m3u8Url = await page.evaluate(() => {
      try {
        return jwplayer().getPlaylist()[0].file;
      } catch (e) {
        return null;
      }
    });

    await browser.close();

    if (m3u8Url && m3u8Url.includes('.m3u8')) {
      res.json({ success: true, url: m3u8Url });
    } else {
      res.status(404).json({ success: false, error: 'Não foi possível extrair a URL .m3u8 do player' });
    }

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API de extração de link m3u8 ativa');
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
