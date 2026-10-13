const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../db');

function sign(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return await User.findByPk(payload.sub);
  } catch {
    return null;
  }
}

/** Attaches req.user if a valid token is present; never rejects. */
async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

/** Rejects with 401 unless a valid token is present. */
async function requireAuth(req, res, next) {
  req.user = await resolveUser(req);
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

module.exports = { sign, optionalAuth, requireAuth };
