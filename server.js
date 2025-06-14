const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const url = `https://c1z39.com/bkg/${code}`;

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Injetando a lógica que funcionou no console do navegador
    const m3u8Url = await page.evaluate(async () => {
      function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      for (let retries = 0; retries < 20; retries++) {
        if (typeof jwplayer === "function") {
          const player = jwplayer("vplayer");

          const file =
            player?.getConfig?.().sources?.[0]?.file ||
            player?.getPlaylist?.()[0]?.file;

          if (file && file.includes(".m3u8")) {
            return file;
          }
        }

        await wait(1000); // espera 1s antes da próxima tentativa
      }

      return null; // se não encontrar
    });

    await browser.close();

    if (m3u8Url) {
      res.json({ success: true, url: m3u8Url });
    } else {
      res.status(404).json({ success: false, error: '❌ Não foi possível extrair o link m3u8.' });
    }

  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro no servidor: ' + err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API de extração de link m3u8 ativa via lógica confiável do console');
});

app.listen(PORT, () => {
  console.log(`Servidor online em http://localhost:${PORT}`);
});
