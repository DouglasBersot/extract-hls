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

    // Aguarda jwplayer carregar e estar pronto
    await page.waitForFunction(() => {
      return typeof jwplayer === 'function' &&
             jwplayer().getPlaylist &&
             jwplayer().getPlaylist().length > 0 &&
             jwplayer().getPlaylist()[0].file;
    }, { timeout: 10000 });

    const hls = await page.evaluate(() => jwplayer().getPlaylist()[0].file);

    await browser.close();

    if (hls && hls.includes('.m3u8')) {
      res.json({ success: true, url: hls });
    } else {
      res.status(404).json({ success: false, error: 'Link não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
