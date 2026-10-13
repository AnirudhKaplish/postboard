const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../db');
const { validate } = require('../middleware/validate');
const { sign, requireAuth } = require('../middleware/auth');
const schemas = require('../schemas');
const { publicUser } = require('../serialize');

const router = express.Router();

router.post('/register', validate(schemas.register), async (req, res) => {
  const { username, email, password } = req.valid.body;

  const existing = await User.findOne({
    where: { [Op.or]: [{ username }, { email }] },
  });
  if (existing) {
    const field = existing.username.toLowerCase() === username.toLowerCase() ? 'username' : 'email';
    return res.status(409).json({
      error: 'Validation failed',
      fields: { [field]: `That ${field} is already taken` },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, passwordHash });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', validate(schemas.login), async (req, res) => {
  const { identifier, password } = req.valid.body;
  const user = await User.findOne({
    where: { [Op.or]: [{ username: identifier }, { email: identifier.toLowerCase() }] },
  });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid username/email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
