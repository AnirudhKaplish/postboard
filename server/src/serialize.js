const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, createdAt: u.createdAt });

const authorOf = (a) => (a ? { id: a.id, username: a.username } : { id: null, username: '[deleted]' });

function serializePost(p, { full = false } = {}) {
  const out = {
    id: p.id,
    title: p.title,
    excerpt: p.body.length > 220 ? p.body.slice(0, 220).trimEnd() + '…' : p.body,
    author: authorOf(p.author),
    likeCount: Number(p.get('likeCount') || 0),
    commentCount: Number(p.get('commentCount') || 0),
    likedByMe: Boolean(Number(p.get('likedByMe') || 0)),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  if (full) out.body = p.body;
  return out;
}

const serializeComment = (c) => ({
  id: c.id,
  body: c.body,
  postId: c.postId,
  author: authorOf(c.author),
  createdAt: c.createdAt,
});

module.exports = { publicUser, serializePost, serializeComment };
