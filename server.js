const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let relPath = decodeURIComponent(parsed.pathname);
    if (relPath === '/' || relPath === '/lab.html') relPath = '/index.html';

    const cleanRel = relPath.replace(/^[/\\]+/, '');
    const safePath = path.resolve(ROOT, cleanRel);
    const relFromRoot = path.relative(ROOT, safePath);
    if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      const isVendor = relPath.startsWith('/vendor/');
      const headers = {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': isVendor ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate',
        'Pragma': isVendor ? 'public' : 'no-cache',
        'Expires': '0'
      };

      const acceptEncoding = req.headers['accept-encoding'] || '';
      const rawStream = fs.createReadStream(safePath);

      if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('br')) {
        headers['Content-Encoding'] = 'br';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        rawStream.pipe(zlib.createBrotliCompress({
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
        })).pipe(res);
      } else if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('gzip')) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        rawStream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
      } else {
        headers['Content-Length'] = stat.size;
        res.writeHead(200, headers);
        rawStream.pipe(res);
      }
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log(`ХимЛаб 3D сервер запущен на http://${HOST}:${PORT} (локально: ${localUrl})`);
  if (process.argv.includes('--open')) {
    if (process.platform === 'win32') {
      exec(`cmd /c start "" "${localUrl}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${localUrl}"`);
    } else if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
      exec(`xdg-open "${localUrl}" >/dev/null 2>&1 || true`);
    }
  }
});
