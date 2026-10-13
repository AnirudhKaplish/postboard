const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');

const router = express.Router();
const DAYS = 30;

// "YYYY-MM-DD" string for a timestamp column, per database.
const dialect = sequelize.getDialect();
const dayOf = (col) =>
  dialect === 'postgres'
    ? `TO_CHAR(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
    : dialect === 'mysql'
      ? `DATE_FORMAT(${col}, '%Y-%m-%d')`
      : `DATE(${col})`;

// Per-post engagement, reused by several queries below.
const POST_STATS = `
  WITH post_stats AS (
    SELECT p.id, p.title, p.user_id,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments
    FROM posts p
  )`;

const sinceString = (days) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10) + ' 00:00:00';
};

const num = (v) => Number(v || 0);
const q = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

async function loadInsights() {
  const since = sinceString(DAYS);

  const [totalsRows, postsByDay, commentsByDay, [engagement], topPosts, topAuthors] = await Promise.all([
    q(`SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM posts) AS posts,
         (SELECT COUNT(*) FROM comments) AS comments,
         (SELECT COUNT(*) FROM likes) AS likes`),
    q(`SELECT ${dayOf('created_at')} AS day, COUNT(*) AS n FROM posts WHERE created_at >= :since GROUP BY ${dayOf('created_at')}`, { since }),
    q(`SELECT ${dayOf('created_at')} AS day, COUNT(*) AS n FROM comments WHERE created_at >= :since GROUP BY ${dayOf('created_at')}`, { since }),
    q(`${POST_STATS}
       SELECT COUNT(*) AS total_posts,
              SUM(CASE WHEN likes + comments > 0 THEN 1 ELSE 0 END) AS engaged_posts
       FROM post_stats`),
    q(`${POST_STATS}
       SELECT ps.id, ps.title, u.username AS author, ps.likes, ps.comments, ps.likes + ps.comments AS engagement
       FROM post_stats ps JOIN users u ON u.id = ps.user_id
       ORDER BY engagement DESC, ps.id DESC
       LIMIT 5`),
    // Window function: rank authors by the engagement their posts received.
    q(`${POST_STATS}
       SELECT u.username,
              COUNT(ps.id) AS posts,
              SUM(ps.likes) AS likes,
              SUM(ps.comments) AS comments,
              SUM(ps.likes + ps.comments) AS engagement,
              RANK() OVER (ORDER BY SUM(ps.likes + ps.comments) DESC) AS author_rank
       FROM users u JOIN post_stats ps ON ps.user_id = u.id
       GROUP BY u.id, u.username
       ORDER BY engagement DESC, u.username ASC
       LIMIT 5`),
  ]);

  const totals = totalsRows[0];

  // Fill days with no activity so charts have a continuous x-axis.
  const postMap = new Map(postsByDay.map((r) => [String(r.day).slice(0, 10), num(r.n)]));
  const commentMap = new Map(commentsByDay.map((r) => [String(r.day).slice(0, 10), num(r.n)]));
  const daily = [];
  const start = new Date(since.slice(0, 10) + 'T00:00:00Z');
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    daily.push({ day, posts: postMap.get(day) || 0, comments: commentMap.get(day) || 0 });
  }

  const totalPosts = num(engagement.total_posts);
  const engagedPosts = num(engagement.engaged_posts);
  const t = { users: num(totals.users), posts: num(totals.posts), comments: num(totals.comments), likes: num(totals.likes) };
  const round = (n) => Math.round(n * 100) / 100;

  return {
    totals: t,
    kpis: {
      engagementRate: totalPosts ? round(engagedPosts / totalPosts) : 0, // share of posts with >=1 like or comment
      commentsPerPost: totalPosts ? round(t.comments / totalPosts) : 0,
      likesPerPost: totalPosts ? round(t.likes / totalPosts) : 0,
      postsPerUser: t.users ? round(t.posts / t.users) : 0,
    },
    daily,
    topPosts: topPosts.map((r) => ({ id: num(r.id), title: r.title, author: r.author, likes: num(r.likes), comments: num(r.comments), engagement: num(r.engagement) })),
    topAuthors: topAuthors.map((r) => ({ username: r.username, posts: num(r.posts), likes: num(r.likes), comments: num(r.comments), engagement: num(r.engagement), rank: num(r.author_rank) })),
    windowDays: DAYS,
    generatedAt: new Date().toISOString(),
  };
}

router.get('/', async (_req, res) => {
  res.json(await loadInsights());
});

const csvCell = (v) => {
  const s = String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

router.get('/export.csv', async (_req, res) => {
  const data = await loadInsights();
  const rows = [['day', 'posts', 'comments'], ...data.daily.map((d) => [d.day, d.posts, d.comments])];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="postboard-daily-activity.csv"');
  res.send(rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
});

module.exports = router;
