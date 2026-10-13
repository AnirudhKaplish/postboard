import { Link } from 'react-router-dom';
import { timeAgo } from '../util.js';

export default function PostCard({ post }) {
  return (
    <article className="card">
      <h2 className="card-title">
        <Link to={`/posts/${post.id}`}>{post.title}</Link>
      </h2>
      <p className="card-excerpt">{post.excerpt}</p>
      <footer className="card-meta">
        <span>@{post.author.username} · {timeAgo(post.createdAt)}</span>
        <span className="stats">
          <span title="Likes" className={post.likedByMe ? 'liked' : ''}>♥ {post.likeCount}</span>
          <span title="Comments">💬 {post.commentCount}</span>
        </span>
      </footer>
    </article>
  );
}
