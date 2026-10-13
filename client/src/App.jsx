import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Insights from './pages/Insights.jsx';
import PostDetail from './pages/PostDetail.jsx';
import PostEditor from './pages/PostEditor.jsx';
import { Login, Register } from './pages/AuthPages.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="state">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function NotFound() {
  return (
    <div className="state">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link className="btn" to="/">Back to the board</Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/new" element={<Protected><PostEditor /></Protected>} />
          <Route path="/posts/:id/edit" element={<Protected><PostEditor /></Protected>} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">Postboard · open source · MIT · <a href="/api/docs/">API docs</a></footer>
    </>
  );
}
