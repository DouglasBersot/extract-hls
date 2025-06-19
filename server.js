app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const url = `https://c1z39.com/bkg/${code}`;

  try {
    const executablePath = puppeteer.executablePath();
    console.log('Chromium path:', executablePath); // <-- AQUI

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath,
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
      res.status(404).json({ success: false, error: 'Link não encontrado' });
    }
  } catch (err) {
    console.error('Erro na rota /api/getm3u8:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
