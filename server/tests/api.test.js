process.env.NODE_ENV = 'test';
const request = require('supertest');
const { sequelize } = require('../src/db');
const { createApp } = require('../src/app');

const app = createApp();

beforeAll(async () => {
  await sequelize.sync({ force: true });
});
afterAll(async () => {
  await sequelize.close();
});

const register = async (username) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@test.dev`, password: 'password123' });
  return res;
};
const authed = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth', () => {
  test('registers, rejects duplicates, logs in, returns /me', async () => {
    const res = await register('alice');
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const dup = await register('alice');
    expect(dup.status).toBe(409);
    expect(dup.body.fields.username).toMatch(/taken/);

    const login = await request(app).post('/api/auth/login').send({ identifier: 'alice@test.dev', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(authed(login.body.token));
    expect(me.body.user.username).toBe('alice');
  });

  test('rejects bad credentials and invalid input', async () => {
    const bad = await request(app).post('/api/auth/login').send({ identifier: 'alice', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const invalid = await request(app).post('/api/auth/register').send({ username: 'a', email: 'nope', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.fields)).toEqual(expect.arrayContaining(['username', 'email', 'password']));
  });

  test('/me requires a valid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authed('garbage'))).status).toBe(401);
  });
});

describe('posts', () => {
  let alice, bob, postId;

  beforeAll(async () => {
    alice = (await request(app).post('/api/auth/login').send({ identifier: 'alice', password: 'password123' })).body.token;
    bob = (await register('bob')).body.token;
  });

  test('requires auth to create', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'Hello there', body: 'World' });
    expect(res.status).toBe(401);
  });

  test('validates input', async () => {
    const res = await request(app).post('/api/posts').set(authed(alice)).send({ title: 'x', body: '' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('title');
    expect(res.body.fields).toHaveProperty('body');
  });

  test('creates and fetches a post', async () => {
    const res = await request(app).post('/api/posts').set(authed(alice)).send({ title: 'First post', body: 'Hello world' });
    expect(res.status).toBe(201);
    expect(res.body.post.author.username).toBe('alice');
    postId = res.body.post.id;

    const get = await request(app).get(`/api/posts/${postId}`);
    expect(get.status).toBe(200);
    expect(get.body.post.body).toBe('Hello world');
    expect(get.body.post.likeCount).toBe(0);
  });

  test('404s on missing or malformed ids', async () => {
    expect((await request(app).get('/api/posts/99999')).status).toBe(404);
    expect((await request(app).get('/api/posts/abc')).status).toBe(404);
  });

  test('only the owner can edit or delete', async () => {
    const payload = { title: 'Hijacked', body: 'nope' };
    expect((await request(app).put(`/api/posts/${postId}`).set(authed(bob)).send(payload)).status).toBe(403);
    expect((await request(app).delete(`/api/posts/${postId}`).set(authed(bob))).status).toBe(403);

    const ok = await request(app).put(`/api/posts/${postId}`).set(authed(alice)).send({ title: 'First post (edited)', body: 'Hello again' });
    expect(ok.status).toBe(200);
    expect(ok.body.post.title).toBe('First post (edited)');
  });

  test('lists with search, pagination and sorting', async () => {
    for (let i = 1; i <= 12; i++) {
      await request(app).post('/api/posts').set(authed(bob)).send({ title: `Bob post ${i}`, body: i === 7 ? 'needle in haystack' : 'filler text' });
    }
    const page1 = await request(app).get('/api/posts?limit=5&page=1');
    expect(page1.body.posts).toHaveLength(5);
    expect(page1.body.total).toBe(13);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.posts[0].title).toBe('Bob post 12');

    const page3 = await request(app).get('/api/posts?limit=5&page=3');
    expect(page3.body.posts).toHaveLength(3);

    const search = await request(app).get('/api/posts?q=NEEDLE');
    expect(search.body.posts).toHaveLength(1);
    expect(search.body.posts[0].title).toBe('Bob post 7');

    const byAuthor = await request(app).get('/api/posts?author=alice');
    expect(byAuthor.body.total).toBe(1);

    expect((await request(app).get('/api/posts?limit=1000')).status).toBe(400);
  });

  test('likes toggle and are reflected per user; popular sort works', async () => {
    const like = await request(app).post(`/api/posts/${postId}/like`).set(authed(bob));
    expect(like.body).toEqual({ liked: true, likeCount: 1 });

    const asBob = await request(app).get(`/api/posts/${postId}`).set(authed(bob));
    expect(asBob.body.post.likedByMe).toBe(true);
    const anon = await request(app).get(`/api/posts/${postId}`);
    expect(anon.body.post.likedByMe).toBe(false);

    const popular = await request(app).get('/api/posts?sort=popular&limit=3');
    expect(popular.body.posts[0].id).toBe(postId);

    const unlike = await request(app).post(`/api/posts/${postId}/like`).set(authed(bob));
    expect(unlike.body).toEqual({ liked: false, likeCount: 0 });
    expect((await request(app).post(`/api/posts/${postId}/like`)).status).toBe(401);
  });

  test('comments: create, list, count, owner-only delete', async () => {
    const empty = await request(app).post(`/api/posts/${postId}/comments`).set(authed(bob)).send({ body: '   ' });
    expect(empty.status).toBe(400);

    const created = await request(app).post(`/api/posts/${postId}/comments`).set(authed(bob)).send({ body: 'Nice one!' });
    expect(created.status).toBe(201);
    expect(created.body.comment.author.username).toBe('bob');

    const list = await request(app).get(`/api/posts/${postId}/comments`);
    expect(list.body.comments).toHaveLength(1);

    const post = await request(app).get(`/api/posts/${postId}`);
    expect(post.body.post.commentCount).toBe(1);

    const cid = created.body.comment.id;
    expect((await request(app).delete(`/api/comments/${cid}`).set(authed(alice))).status).toBe(403);
    expect((await request(app).delete(`/api/comments/${cid}`).set(authed(bob))).status).toBe(204);
    expect((await request(app).delete(`/api/comments/${cid}`).set(authed(bob))).status).toBe(404);
  });

  test('deleting a post removes its comments and likes', async () => {
    await request(app).post(`/api/posts/${postId}/comments`).set(authed(bob)).send({ body: 'bye' });
    await request(app).post(`/api/posts/${postId}/like`).set(authed(bob));
    expect((await request(app).delete(`/api/posts/${postId}`).set(authed(alice))).status).toBe(204);
    expect((await request(app).get(`/api/posts/${postId}`)).status).toBe(404);
    expect((await request(app).get(`/api/posts/${postId}/comments`)).status).toBe(404);
  });
});

describe('misc', () => {
  test('health, unknown api route, bad json', async () => {
    expect((await request(app).get('/api/health')).body.status).toBe('ok');
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
  });
});
