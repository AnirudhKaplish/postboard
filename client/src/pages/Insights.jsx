import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { parseError } from '../api.js';
import ActivityChart from '../components/ActivityChart.jsx';

const pct = (n) => `${Math.round(n * 100)}%`;

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export default function Insights() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/insights')
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(parseError(err).message));
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="alert" role="alert">{error}</p>;
  if (!data) return <p className="state">Loading insights…</p>;

  const { totals, kpis, daily, topPosts, topAuthors } = data;
  const hasActivity = totals.posts > 0;

  return (
    <>
      <section className="hero">
        <h1>Insights</h1>
        <p>How the community is doing, computed live from the database with SQL aggregations.</p>
      </section>

      <div className="stats">
        <Stat label="Members" value={totals.users} />
        <Stat label="Posts" value={totals.posts} />
        <Stat label="Comments" value={totals.comments} />
        <Stat label="Likes" value={totals.likes} />
      </div>

      <div className="stats">
        <Stat label="Engagement rate" value={pct(kpis.engagementRate)} hint="Posts with at least one like or comment" />
        <Stat label="Comments per post" value={kpis.commentsPerPost} />
        <Stat label="Likes per post" value={kpis.likesPerPost} />
        <Stat label="Posts per member" value={kpis.postsPerUser} />
      </div>

      <section className="panel section">
        <div className="section-head">
          <h2>Activity, last {data.windowDays} days</h2>
          <a className="btn btn-ghost btn-small" href="/api/insights/export.csv" download>Export CSV</a>
        </div>
        <ActivityChart data={daily} />
      </section>

      {hasActivity ? (
        <div className="two-col">
          <section className="panel section">
            <h2>Top posts</h2>
            <table className="table">
              <thead><tr><th>Post</th><th className="num">♥</th><th className="num">💬</th></tr></thead>
              <tbody>
                {topPosts.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/posts/${p.id}`}>{p.title}</Link><div className="muted small">@{p.author}</div></td>
                    <td className="num">{p.likes}</td>
                    <td className="num">{p.comments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel section">
            <h2>Author leaderboard</h2>
            <table className="table">
              <thead><tr><th>#</th><th>Author</th><th className="num">Posts</th><th className="num">Engagement</th></tr></thead>
              <tbody>
                {topAuthors.map((a) => (
                  <tr key={a.username}>
                    <td>{a.rank}</td>
                    <td>@{a.username}</td>
                    <td className="num">{a.posts}</td>
                    <td className="num">{a.engagement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">Engagement = likes + comments received on an author's posts.</p>
          </section>
        </div>
      ) : (
        <p className="state">No posts yet, so there is nothing to rank.</p>
      )}
    </>
  );
}
