const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const url = `https://c1z39.com/bkg/${code}`;

  try {
    console.log(`[+] Iniciando Chromium para: ${code}`);

    const browser = await puppeteer.launch({
  headless: chromium.headless,
  executablePath: process.env.CHROME_PATH || (await chromium.executablePath()),
  args: chromium.args
});


    console.log('[+] Chromium iniciado com sucesso');
    const page = await browser.newPage();

    console.log(`[+] Carregando URL: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('[+] Página carregada com sucesso');

    const hls = await page.evaluate(() => {
      try {
        return jwplayer().getPlaylist()[0].file;
      } catch (e) {
        return null;
      }
    });

    console.log('[+] Resultado extraído:', hls);
    await browser.close();

    if (hls && hls.includes('.m3u8')) {
      res.json({ success: true, url: hls });
    } else {
      res.status(404).json({ success: false, error: 'Link .m3u8 não encontrado' });
    }
  } catch (err) {
    console.error('[✖] Erro ao extrair:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API Puppeteer online (Railway) - Use /api/getm3u8/{code}');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
