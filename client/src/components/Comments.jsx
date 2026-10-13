import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { parseError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { timeAgo } from '../util.js';

export default function Comments({ postId, onCount }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/posts/${postId}/comments`)
      .then((res) => { if (!cancelled) { setComments(res.data.comments); onCount?.(res.data.comments.length); } })
      .catch((err) => !cancelled && setError(parseError(err).message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await api.post(`/posts/${postId}/comments`, { body });
      const next = [...comments, res.data.comment];
      setComments(next);
      onCount?.(next.length);
      setBody('');
    } catch (err) {
      const { message, fields } = parseError(err);
      setError(fields.body || message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (cid) => {
    try {
      await api.delete(`/comments/${cid}`);
      const next = comments.filter((c) => c.id !== cid);
      setComments(next);
      onCount?.(next.length);
    } catch (err) {
      setError(parseError(err).message);
    }
  };

  return (
    <section className="comments" aria-labelledby="comments-h">
      <h2 id="comments-h">Comments{comments ? ` (${comments.length})` : ''}</h2>

      {user ? (
        <form onSubmit={submit} className="comment-form">
          <label htmlFor="comment" className="sr-only">Add a comment</label>
          <textarea id="comment" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add to the conversation…" />
          <button className="btn" type="submit" disabled={sending || !body.trim()}>{sending ? 'Posting…' : 'Comment'}</button>
        </form>
      ) : (
        <p className="muted"><Link to="/login" state={{ from: `/posts/${postId}` }}>Log in</Link> to join the conversation.</p>
      )}

      {error && <p className="alert" role="alert">{error}</p>}
      {!comments && !error && <p className="muted">Loading comments…</p>}
      {comments && comments.length === 0 && <p className="muted">No comments yet.</p>}
      <ul className="comment-list">
        {comments?.map((c) => (
          <li key={c.id}>
            <div className="comment-head">
              <strong>@{c.author.username}</strong>
              <span className="muted">{timeAgo(c.createdAt)}</span>
              {user?.id === c.author.id && (
                <button className="link-btn danger" onClick={() => remove(c.id)} aria-label="Delete comment">Delete</button>
              )}
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
