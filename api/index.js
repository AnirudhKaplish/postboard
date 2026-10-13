// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json).
// The Express app is created once per warm instance; tables are created on first use.
const { sequelize } = require('../server/src/db');
const { createApp } = require('../server/src/app');

const app = createApp();
let ready = null;

module.exports = async (req, res) => {
  try {
    ready = ready || sequelize.sync();
    await ready;
  } catch (err) {
    ready = null; // retry on the next request
    console.error('Database unavailable:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Database unavailable. Check DATABASE_URL.' }));
  }
  return app(req, res);
};
