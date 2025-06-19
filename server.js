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

// 🔁 Proxy inteligente que reescreve playlists e repassa arquivos (.ts, .key, etc)
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.m3u8;
  if (!targetUrl) return res.status(400).send('URL ausente.');

  try {
    // Se for playlist (.m3u8), pedimos como texto para reescrever links
    const isPlaylist = targetUrl.includes('.m3u8');
    const response = await got(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://c1z39.com/',
      },
      responseType: isPlaylist ? 'text' : 'buffer',
    });

    if (isPlaylist) {
      let content = response.body;
      const base = new URL(targetUrl);
      base.pathname = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

      // Reescreve URI da chave AES (ex: URI="https://dominio/encryption.key?...") para proxy
      content = content.replace(/URI="([^"]+)"/g, (match, url) => {
        const absoluteUrl = url.startsWith('http') ? url : new URL(url, base).href;
        return `URI="${req.protocol}://${req.get('host')}/proxy?m3u8=${encodeURIComponent(absoluteUrl)}"`;
      });

      // Reescreve URLs relativas e absolutas de segmentos .ts e playlists .m3u8 para proxy
      content = content.replace(/^(?!#)(.*\.(ts|m3u8)(\?.*)?)$/gm, (match) => {
        // Se for URL absoluta, mantém, senão concatena base
        const absoluteUrl = match.startsWith('http') ? match : new URL(match, base).href;
        return `${req.protocol}://${req.get('host')}/proxy?m3u8=${encodeURIComponent(absoluteUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(content);
    } else {
      // Para arquivos binários (.ts, .key, etc) repassa o buffer direto
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(response.body);
    }
  } catch (err) {
    console.error('Erro ao acessar conteúdo:', err.message);
    return res.status(502).send(`Erro ao acessar conteúdo. ${err.message}`);
  }
});

// Página padrão
app.get('/', (req, res) => {
  res.send('🟢 API + Proxy com reescrita HLS está rodando. Use /api/getm3u8/{code} e /proxy?m3u8=...');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
