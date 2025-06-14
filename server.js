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
    let m3u8BaseUrl = null;

    // Captura a primeira requisição de segmento .ts
    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('.ts') && reqUrl.includes('?t=') && !m3u8BaseUrl) {
        // Remove o último segmento (ex: /seg-1.ts) e adiciona /master.m3u8
        const masterUrl = reqUrl.replace(/\/[^\/]+\.ts/, '/master.m3u8');
        m3u8BaseUrl = masterUrl;
        console.log('🎯 Capturado .ts => Construído:', masterUrl);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Dá play no vídeo automaticamente (ativa a geração dos .ts)
    await page.evaluate(() => {
      const player = jwplayer && jwplayer("vplayer");
      if (player) player.play();
    });

    // Espera até capturar o .ts (5 segundos)
    await new Promise(resolve => setTimeout(resolve, 5000));

    await browser.close();

    if (m3u8BaseUrl) {
      res.json({ success: true, url: m3u8BaseUrl });
    } else {
      res.status(404).json({ success: false, error: 'Master.m3u8 não encontrado via interceptação de .ts' });
    }
  } catch (err) {
    console.error('❌ Erro ao extrair o link:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API Puppeteer Online - Use /api/getm3u8/{file_code}');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
