import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import got from 'got';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🔎 API que extrai o master.m3u8 a partir de um código
app.get('/api/getm3u8/:code', async (req, res) => {
  const { code } = req.params;
  const targetUrl = `https://c1z39.com/bkg/${code}`;

  try {
    console.log('🔧 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    let tsSegmentUrl = null;

    page.on('request', request => {
      const url = request.url();
      if (url.includes('.ts')) {
        console.log('🎯 Interceptado .ts:', url);
        if (!tsSegmentUrl) tsSegmentUrl = url;
      }
    });

    console.log('🌐 Acessando:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();

    if (tsSegmentUrl) {
      const masterUrl = tsSegmentUrl.replace(/\/[^/]+\.ts/, '/master.m3u8');
      console.log('✅ Reconstruído:', masterUrl);
      return res.json({ success: true, url: masterUrl });
    } else {
      return res.status(404).json({ success: false, error: 'Segmento .ts não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 🔁 Proxy inteligente que reescreve playlists
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.m3u8;
  if (!targetUrl) return res.status(400).send('URL ausente.');

  try {
    const response = await got(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://c1z39.com/',
      },
      responseType: 'text',
    });

    let content = response.body;

    if (targetUrl.includes('.m3u8')) {
      // Reescreve as URLs de segmentos e playlists internas
      const base = targetUrl.split('/').slice(0, -1).join('/');
      content = content.replace(/^(?!#)(.*\.m3u8.*|.*\.ts.*)$/gm, match => {
        const absolute = match.startsWith('http') ? match : `${base}/${match}`;
        return `/proxy?m3u8=${encodeURIComponent(absolute)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else {
      // Conteúdo binário (ex: .ts)
      res.setHeader('Content-Type', 'video/MP2T');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  } catch (err) {
    console.error('Erro ao acessar conteúdo:', err.message);
    res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
  }
});

// Página padrão
app.get('/', (req, res) => {
  res.send('🟢 API + Proxy com reescrita HLS está rodando. Use /api/getm3u8/{code} e /proxy?m3u8=...');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
