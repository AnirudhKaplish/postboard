const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { createSummarizer } = require('./services/summarizer');

function createApp({ summarizer } = {}) {
  const app = express();
  app.locals.summarizer = summarizer || createSummarizer(config.ai);
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.env === 'test',
    message: { error: 'Too many attempts, please try again later' },
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiEnabled: app.locals.summarizer.enabled }));
  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/posts', require('./routes/posts'));
  app.use('/api/comments', require('./routes/comments'));
  app.use('/api/insights', require('./routes/insights'));

  // API documentation: OpenAPI spec + Swagger UI (UI assets come from jsDelivr, so nothing heavy is bundled)
  app.get('/api/openapi.json', (_req, res) => res.json(require('./openapi')));
  app.use(
    '/api/docs',
    (_req, res, next) => {
      // Swagger UI needs its CDN scripts and inline styles; relax the CSP for this route only.
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net; font-src 'self' data:; connect-src 'self'"
      );
      next();
    },
    express.static(path.join(__dirname, 'docs-ui'))
  );

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built client (single-container deployments)
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    if (err.status && err.status < 500 || err.status === 502 || err.status === 503) {
      if (err.cause) console.error(err.cause);
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
