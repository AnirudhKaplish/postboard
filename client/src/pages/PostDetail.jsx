import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { parseError } from '../api.js';
import { useAuth } from '../auth.jsx';
import Comments from '../components/Comments.jsx';
import SummaryPanel from '../components/SummaryPanel.jsx';
import { timeAgo } from '../util.js';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    api.get('/health').then((res) => setAiEnabled(Boolean(res.data.aiEnabled))).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setError('');
    api
      .get(`/posts/${id}`)
      .then((res) => !cancelled && setPost(res.data.post))
      .catch((err) => !cancelled && setError(parseError(err).message));
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (error) {
    return (
      <div className="state">
        <p className="alert" role="alert">{error}</p>
        <Link className="btn" to="/">Back to the board</Link>
      </div>
    );
  }
  if (!post) return <p className="state">Loading…</p>;

  const isOwner = user && user.id === post.author.id;

  const toggleLike = async () => {
    if (!user) return navigate('/login', { state: { from: `/posts/${id}` } });
    setBusy(true);
    try {
      const res = await api.post(`/posts/${id}/like`);
      setPost((p) => ({ ...p, likedByMe: res.data.liked, likeCount: res.data.likeCount }));
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this post and all its comments? This cannot be undone.')) return;
    try {
      await api.delete(`/posts/${id}`);
      navigate('/');
    } catch (err) {
      setError(parseError(err).message);
    }
  };

  return (
    <article className="panel">
      <Link to="/" className="back">← Back to the board</Link>
      <h1 className="post-title">{post.title}</h1>
      <p className="muted">
        by <Link to={`/?author=${post.author.username}`}>@{post.author.username}</Link>
        {' · '}{timeAgo(post.createdAt)}
        {post.updatedAt !== post.createdAt && ' · edited'}
      </p>
      <div className="post-body">{post.body}</div>
      <div className="actions left">
        <button className={`btn btn-ghost like ${post.likedByMe ? 'liked' : ''}`} onClick={toggleLike} disabled={busy} aria-pressed={post.likedByMe}>
          ♥ {post.likedByMe ? 'Liked' : 'Like'} · {post.likeCount}
        </button>
        {isOwner && (
          <>
            <Link className="btn btn-ghost" to={`/posts/${post.id}/edit`}>Edit</Link>
            <button className="btn btn-danger" onClick={remove}>Delete</button>
          </>
        )}
      </div>
      {aiEnabled && user && <SummaryPanel postId={post.id} refreshKey={post.commentCount} />}
      <Comments postId={post.id} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />
    </article>
  );
}
