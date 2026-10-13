import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';
import { AuthProvider } from '../auth.jsx';
import api from '../api.js';
import { timeAgo } from '../util.js';

vi.mock('../api.js', async () => {
  const actual = await vi.importActual('../api.js');
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

test('home lists posts from the API', async () => {
  api.get.mockResolvedValue({
    data: {
      posts: [{ id: 1, title: 'Hello board', excerpt: 'First!', author: { id: 1, username: 'ada' }, likeCount: 2, commentCount: 1, likedByMe: false, createdAt: new Date().toISOString() }],
      page: 1, totalPages: 1, total: 1, limit: 9,
    },
  });
  renderAt('/');
  expect(await screen.findByRole('link', { name: 'Hello board' })).toBeInTheDocument();
  expect(screen.getByText(/@ada/)).toBeInTheDocument();
});

test('home shows an error when the API fails', async () => {
  api.get.mockRejectedValue(new Error('network'));
  renderAt('/');
  expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
});

test('protected routes redirect anonymous users to login', async () => {
  renderAt('/new');
  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
});

test('register form validates before calling the API', async () => {
  renderAt('/register');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
  await waitFor(() => expect(screen.getAllByText('Required').length).toBe(3));
  expect(api.post).not.toHaveBeenCalled();
});

test('timeAgo formats relative times', () => {
  expect(timeAgo(new Date().toISOString())).toBe('just now');
  expect(timeAgo(new Date(Date.now() - 2 * 3600 * 1000).toISOString())).toBe('2 hours ago');
});

test('insights page renders KPIs and rankings', async () => {
  api.get.mockResolvedValue({
    data: {
      totals: { users: 3, posts: 4, comments: 5, likes: 6 },
      kpis: { engagementRate: 0.75, commentsPerPost: 1.25, likesPerPost: 1.5, postsPerUser: 1.33 },
      daily: Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, posts: i % 3, comments: i % 2 })),
      topPosts: [{ id: 1, title: 'Top one', author: 'ada', likes: 2, comments: 3, engagement: 5 }],
      topAuthors: [{ username: 'ada', posts: 2, likes: 2, comments: 3, engagement: 5, rank: 1 }],
      windowDays: 30,
    },
  });
  renderAt('/insights');
  expect(await screen.findByText('75%')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Top one' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /posts and comments per day/i })).toBeInTheDocument();
});

test('summary panel shows the AI result and surfaces errors', async () => {
  const { default: SummaryPanel } = await import('../components/SummaryPanel.jsx');
  api.post.mockResolvedValueOnce({
    data: { summary: { summary: 'A tidy recap.', keyPoints: ['Point A'], openQuestions: [], sentiment: 'positive', cached: false } },
  });
  render(<SummaryPanel postId={1} />);
  await userEvent.click(screen.getByRole('button', { name: /summarize this discussion/i }));
  expect(await screen.findByText('A tidy recap.')).toBeInTheDocument();
  expect(screen.getByText('Point A')).toBeInTheDocument();

  api.post.mockRejectedValueOnce({ response: { data: { error: 'AI not configured' } } });
  await userEvent.click(screen.getByRole('button', { name: /summarize again/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('AI not configured');
});
