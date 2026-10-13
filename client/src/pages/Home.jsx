import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { parseError } from '../api.js';
import PostCard from '../components/PostCard.jsx';
import Pagination from '../components/Pagination.jsx';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const author = params.get('author') || '';
  const sort = params.get('sort') === 'popular' ? 'popular' : 'new';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  useEffect(() => { setSearch(q); }, [q]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .get('/posts', { params: { q, sort, page, author: author || undefined } })
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(parseError(err).message));
    return () => { cancelled = true; };
  }, [q, sort, page, author]);

  return (
    <>
      <section className="hero">
        <h1>The board</h1>
        <p>Short posts, honest conversation. Join in or just read along.</p>
      </section>

      <div className="toolbar">
        <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim(), page: '' }); }} role="search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
          />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="tabs" role="tablist" aria-label="Sort">
          <button role="tab" aria-selected={sort === 'new'} onClick={() => update({ sort: '', page: '' })}>Newest</button>
          <button role="tab" aria-selected={sort === 'popular'} onClick={() => update({ sort: 'popular', page: '' })}>Popular</button>
        </div>
      </div>

      {author && (
        <p className="muted">
          Showing posts by <strong>@{author}</strong> · <button className="link-btn" onClick={() => update({ author: '', page: '' })}>clear</button>
        </p>
      )}

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <p className="state">Loading posts…</p>}
      {data && data.posts.length === 0 && (
        <p className="state">{q ? `No posts match “${q}”.` : 'No posts yet. Be the first to write one!'}</p>
      )}
      {data && data.posts.length > 0 && (
        <div className="grid">{data.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => { update({ page: p > 1 ? String(p) : '' }); window.scrollTo(0, 0); }} />}
    </>
  );
}
