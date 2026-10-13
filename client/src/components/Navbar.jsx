import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">▤</span> Postboard
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end>Board</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          {user ? (
            <>
              <NavLink to="/new" className="btn btn-small">New post</NavLink>
              <span className="nav-user">@{user.username}</span>
              <button className="link-btn" onClick={() => { logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="btn btn-small">Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
