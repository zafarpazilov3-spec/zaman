// ZAMAN Chaihana - Production Cloud Web Server
// Zero-dependency native Node.js HTTP server for Render, Railway, VPS, or local

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'images', 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const activeTokens = new Set();
let recoveryCode = null;
let recoveryExpires = 0;

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(jsonStr, 'utf8'),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(jsonStr);
}

function handleCors(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

function readBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    // 50MB max body limit
    if (body.length > 50 * 1024 * 1024) {
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (err) {
      callback(err, null);
    }
  });
}

function getConfig() {
  const cfgPath = path.join(DATA_DIR, 'config.json');
  try {
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch (e) {}
  return {
    adminPassword: 'admin',
    adminEmail: 'zafarpazilov3@gmail.com',
    restaurantName: 'ZAMAN',
    subtitle: 'Чайхана • Вкус Времени',
    phone: '+996 556 614 444',
    address: 'Тумонбой Байзакова 137',
    instagram: '@zaman_chaihana',
    currency: 'сом'
  };
}

function saveConfig(cfg) {
  const cfgPath = path.join(DATA_DIR, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 4), 'utf8');
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // ============================================================
  // API ENDPOINTS
  // ============================================================

  // 1. GET /api/menu
  if (pathname === '/api/menu' && req.method === 'GET') {
    const menuPath = path.join(DATA_DIR, 'menu.json');
    try {
      if (fs.existsSync(menuPath)) {
        const content = fs.readFileSync(menuPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        return res.end(content);
      }
    } catch (e) {}
    return sendJson(res, 200, {});
  }

  // 2. POST /api/menu
  if (pathname === '/api/menu' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err || !data || typeof data !== 'object') {
        return sendJson(res, 400, { success: false, message: 'Invalid JSON' });
      }
      try {
        const menuPath = path.join(DATA_DIR, 'menu.json');
        fs.writeFileSync(menuPath, JSON.stringify(data, null, 4), 'utf8');
        return sendJson(res, 200, { success: true, message: 'Меню сохранено' });
      } catch (saveErr) {
        return sendJson(res, 500, { success: false, message: 'Ошибка сохранения на сервере' });
      }
    });
    return;
  }

  // 3. GET /api/config
  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, getConfig());
  }

  // 4. POST /api/config
  if (pathname === '/api/config' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err || !data) return sendJson(res, 400, { success: false });
      const current = getConfig();
      const updated = Object.assign({}, current, data);
      saveConfig(updated);
      return sendJson(res, 200, { success: true, config: updated });
    });
    return;
  }

  // 5. POST /api/upload-photo
  if (pathname === '/api/upload-photo' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err || !data || !data.base64) {
        return sendJson(res, 400, { success: false, message: 'No photo data' });
      }
      try {
        let base64Data = data.base64;
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `dish_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        const relPath = `images/uploads/${filename}`;
        return sendJson(res, 200, { success: true, filePath: relPath });
      } catch (uploadErr) {
        return sendJson(res, 500, { success: false, message: 'Ошибка загрузки фото' });
      }
    });
    return;
  }

  // 6. POST /api/login
  if (pathname === '/api/login' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err || !data || !data.password) {
        return sendJson(res, 400, { success: false, message: 'Введите пароль' });
      }
      const cfg = getConfig();
      if (String(data.password).trim() === String(cfg.adminPassword).trim()) {
        const token = `zaman_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        activeTokens.add(token);
        return sendJson(res, 200, { success: true, token });
      } else {
        return sendJson(res, 401, { success: false, message: 'Неверный пароль' });
      }
    });
    return;
  }

  // 7. POST /api/forgot-password
  if (pathname === '/api/forgot-password' && req.method === 'POST') {
    readBody(req, (err, data) => {
      const email = data ? data.email : '';
      const cfg = getConfig();
      if (!email || email.toLowerCase().trim() !== (cfg.adminEmail || '').toLowerCase().trim()) {
        return sendJson(res, 404, { success: false, message: 'Почта не совпадает с почтой администратора' });
      }
      recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
      recoveryExpires = Date.now() + 30 * 60 * 1000;
      console.log(`[AUTH] Код восстановления для ${email}: ${recoveryCode}`);
      return sendJson(res, 200, {
        success: true,
        message: `Проверочный код: ${recoveryCode}`
      });
    });
    return;
  }

  // 8. POST /api/reset-password
  if (pathname === '/api/reset-password' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (!data || String(data.code).trim() !== String(recoveryCode) || Date.now() > recoveryExpires) {
        return sendJson(res, 400, { success: false, message: 'Неверный или устаревший код' });
      }
      if (!data.newPassword || String(data.newPassword).length < 4) {
        return sendJson(res, 400, { success: false, message: 'Пароль минимум 4 символа' });
      }
      const cfg = getConfig();
      cfg.adminPassword = String(data.newPassword).trim();
      saveConfig(cfg);
      recoveryCode = null;
      const token = `zaman_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      activeTokens.add(token);
      return sendJson(res, 200, { success: true, message: 'Пароль успешно изменен', token });
    });
    return;
  }

  // ============================================================
  // STATIC FILES SERVING
  // ============================================================
  let safePath = pathname;
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  // Prevent directory traversal
  const targetFile = path.normalize(path.join(ROOT_DIR, safePath));
  if (!targetFile.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(targetFile, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA routing if html requested
      if (safePath.endsWith('.html') || !path.extname(safePath)) {
        const indexFile = path.join(ROOT_DIR, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return fs.createReadStream(indexFile).pipe(res);
        }
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    const stream = fs.createReadStream(targetFile);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🍵 ZAMAN Chaihana Server running on port ${PORT}`);
  console.log(`🌐 Local:   http://localhost:${PORT}/`);
  console.log(`📱 Menu:    http://localhost:${PORT}/menu.html`);
  console.log(`⚙️ Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`===============================================`);
});
