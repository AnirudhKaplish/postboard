const express = require('express');
const { Comment } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.delete('/:id', requireAuth, async (req, res) => {
  const comment = /^\d+$/.test(req.params.id) ? await Comment.findByPk(req.params.id) : null;
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own comments' });
  }
  await comment.destroy();
  res.status(204).end();
});

module.exports = router;
