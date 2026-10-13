const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { Op, literal } = require('sequelize');
const { sequelize, Post, User, Comment, Like } = require('../db');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const schemas = require('../schemas');
const { serializePost, serializeComment } = require('../serialize');

const router = express.Router();

const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: 'Too many summary requests, please wait a minute' },
});

// Identifier quoting differs per database (backticks vs double quotes), so ask Sequelize.
const Q = (id) => sequelize.getQueryInterface().queryGenerator.quoteIdentifier(id);
const postId = `${Q('Post')}.${Q('id')}`;
const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like; // Postgres LIKE is case sensitive

const likeCount = literal(`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${postId})`);
const commentCount = literal(`(SELECT COUNT(*) FROM comments WHERE comments.post_id = ${postId})`);
const likedByMe = (userId) =>
  userId
    ? literal(`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${postId} AND likes.user_id = ${Number(userId)})`)
    : literal('0');

const queryOptions = (user) => ({
  attributes: {
    include: [
      [likeCount, 'likeCount'],
      [commentCount, 'commentCount'],
      [likedByMe(user && user.id), 'likedByMe'],
    ],
  },
  include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
});

async function loadPost(id, user) {
  if (!/^\d+$/.test(String(id))) return null;
  return Post.findByPk(id, queryOptions(user));
}

// List posts (search, sort, pagination)
router.get('/', optionalAuth, validate(schemas.listPosts, 'query'), async (req, res) => {
  const { q, page, limit, sort, author } = req.valid.query;

  const where = {};
  if (q) {
    const term = `%${q}%`;
    where[Op.or] = [{ title: { [likeOp]: term } }, { body: { [likeOp]: term } }];
  }

  const authorInclude = {
    model: User,
    as: 'author',
    attributes: ['id', 'username'],
    ...(author ? { where: { username: author }, required: true } : {}),
  };
  const opts = queryOptions(req.user);
  opts.include = [authorInclude];

  const order =
    sort === 'popular'
      ? [[literal(Q('likeCount')), 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']]
      : [['createdAt', 'DESC'], ['id', 'DESC']];

  const { rows, count } = await Post.findAndCountAll({
    ...opts,
    where,
    order,
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  res.json({
    posts: rows.map((p) => serializePost(p)),
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  });
});

// Single post
router.get('/:id', optionalAuth, async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post: serializePost(post, { full: true }) });
});

// Create
router.post('/', requireAuth, validate(schemas.post), async (req, res) => {
  const created = await Post.create({ ...req.valid.body, userId: req.user.id });
  const post = await loadPost(created.id, req.user);
  res.status(201).json({ post: serializePost(post, { full: true }) });
});

// Update (owner only)
router.put('/:id', requireAuth, validate(schemas.post), async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts' });
  await post.update(req.valid.body);
  const fresh = await loadPost(post.id, req.user);
  res.json({ post: serializePost(fresh, { full: true }) });
});

// Delete (owner only)
router.delete('/:id', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
  await Comment.destroy({ where: { postId: post.id } });
  await Like.destroy({ where: { postId: post.id } });
  await post.destroy();
  res.status(204).end();
});

// Toggle like
router.post('/:id/like', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = await Like.findOne({ where: { postId: post.id, userId: req.user.id } });
  if (existing) await existing.destroy();
  else await Like.create({ postId: post.id, userId: req.user.id });

  const count = await Like.count({ where: { postId: post.id } });
  res.json({ liked: !existing, likeCount: count });
});

// Comments for a post
router.get('/:id/comments', async (req, res) => {
  const post = await loadPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = await Comment.findAll({
    where: { postId: post.id },
    include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });
  res.json({ comments: comments.map(serializeComment) });
});

router.post('/:id/comments', requireAuth, validate(schemas.comment), async (req, res) => {
  const post = await loadPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const created = await Comment.create({ body: req.valid.body.body, postId: post.id, userId: req.user.id });
  const comment = await Comment.findByPk(created.id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
  });
  res.status(201).json({ comment: serializeComment(comment) });
});

// AI summary of a post and its discussion
router.post('/:id/summary', requireAuth, summaryLimiter, async (req, res) => {
  const { summarizer } = req.app.locals;
  if (!summarizer.enabled) {
    return res.status(503).json({ error: 'AI summaries are not configured on this server' });
  }
  const post = await loadPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = await Comment.findAll({
    where: { postId: post.id },
    include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });
  const summary = await summarizer.summarize(post, comments);
  res.json({ summary });
});

module.exports = router;
