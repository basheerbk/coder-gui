/* Static server for the gallery: node module-test/serve.js [port]. ES modules don't load from file://. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8710);
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.css': 'text/css; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }
    if (urlPath.endsWith('/')) {
        urlPath += 'index.html';
    }
    const file = path.normalize(path.join(ROOT, urlPath));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
            res.end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}).listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`TinkerBit 3D components: http://localhost:${PORT}/`);
});
