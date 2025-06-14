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

    let finalLink = null;

    // Intercepta todas as respostas de rede
    page.on('response', async response => {
      const responseUrl = response.url();
      if (responseUrl.includes('.m3u8') && responseUrl.includes('?t=')) {
        finalLink = responseUrl;
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Simula clique no centro da tela para ativar o player
    await page.mouse.click(500, 300).catch(() => {});
    await page.waitForTimeout(5000);

    await browser.close();

    if (finalLink) {
      res.json({ success: true, url: finalLink });
    } else {
      res.status(404).json({ success: false, error: 'Link .m3u8 não encontrado via interceptação de rede' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
