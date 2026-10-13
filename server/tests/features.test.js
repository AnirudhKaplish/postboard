process.env.NODE_ENV = 'test';
const request = require('supertest');
const { sequelize } = require('../src/db');
const { createApp } = require('../src/app');
const { createSummarizer, parseModelJson } = require('../src/services/summarizer');

const authed = (t) => ({ Authorization: `Bearer ${t}` });

const fakeClient = (text) => {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        if (text instanceof Error) throw text;
        return { content: [{ type: 'text', text }] };
      },
    },
  };
};

const GOOD = JSON.stringify({
  summary: 'People discuss testing.',
  keyPoints: ['Tests help', 'CI helps'],
  sentiment: 'positive',
  openQuestions: ['Which runner?'],
});

let token, postId;

async function bootstrap(app) {
  await sequelize.sync({ force: true });
  const reg = await request(app).post('/api/auth/register').send({ username: 'carol', email: 'c@t.dev', password: 'password123' });
  token = reg.body.token;
  const post = await request(app).post('/api/posts').set(authed(token)).send({ title: 'Testing tips', body: 'What do you use?' });
  postId = post.body.post.id;
  await request(app).post(`/api/posts/${postId}/comments`).set(authed(token)).send({ body: 'Jest, mostly.' });
  await request(app).post(`/api/posts/${postId}/like`).set(authed(token));
}

afterAll(async () => {
  await sequelize.close();
});

describe('AI summary', () => {
  test('disabled without a key: health says so and endpoint returns 503', async () => {
    const app = createApp({ summarizer: createSummarizer({ apiKey: null, model: 'm' }) });
    await bootstrap(app);
    expect((await request(app).get('/api/health')).body.aiEnabled).toBe(false);
    const res = await request(app).post(`/api/posts/${postId}/summary`).set(authed(token));
    expect(res.status).toBe(503);
  });

  test('returns a structured summary, caches it, and requires auth', async () => {
    const client = fakeClient(`Here you go:\n${GOOD}`);
    const app = createApp({ summarizer: createSummarizer({ client, model: 'test-model' }) });
    await bootstrap(app);
    expect((await request(app).get('/api/health')).body.aiEnabled).toBe(true);

    expect((await request(app).post(`/api/posts/${postId}/summary`)).status).toBe(401);

    const first = await request(app).post(`/api/posts/${postId}/summary`).set(authed(token));
    expect(first.status).toBe(200);
    expect(first.body.summary).toMatchObject({ sentiment: 'positive', cached: false, model: 'test-model' });
    expect(first.body.summary.keyPoints).toHaveLength(2);

    // the thread is passed as delimited untrusted data
    const sent = client.calls[0];
    expect(sent.system).toMatch(/untrusted/);
    expect(sent.messages[0].content).toMatch(/<thread>[\s\S]*Testing tips[\s\S]*Jest, mostly\.[\s\S]*<\/thread>/);

    const second = await request(app).post(`/api/posts/${postId}/summary`).set(authed(token));
    expect(second.body.summary.cached).toBe(true);
    expect(client.calls).toHaveLength(1);

    // a new comment invalidates the cache
    await request(app).post(`/api/posts/${postId}/comments`).set(authed(token)).send({ body: 'Vitest too.' });
    const third = await request(app).post(`/api/posts/${postId}/summary`).set(authed(token));
    expect(third.body.summary.cached).toBe(false);
    expect(client.calls).toHaveLength(2);
  });

  test('maps provider failures and garbage output to 502, unknown post to 404', async () => {
    let app = createApp({ summarizer: createSummarizer({ client: fakeClient(new Error('boom')), model: 'm' }) });
    await bootstrap(app);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await request(app).post(`/api/posts/${postId}/summary`).set(authed(token))).status).toBe(502);

    app = createApp({ summarizer: createSummarizer({ client: fakeClient('sorry, no json'), model: 'm' }) });
    expect((await request(app).post(`/api/posts/${postId}/summary`).set(authed(token))).status).toBe(502);
    expect((await request(app).post('/api/posts/9999/summary').set(authed(token))).status).toBe(404);
    spy.mockRestore();
  });

  test('parseModelJson rejects invalid shapes', () => {
    expect(() => parseModelJson('{"summary":""}')).toThrow();
    expect(parseModelJson(GOOD).sentiment).toBe('positive');
  });
});

describe('AI summary with an OpenAI-compatible provider (free tiers: Groq, Gemini, OpenRouter)', () => {
  test('sends a chat completion request and parses the reply', async () => {
    const http = require('http');
    const seen = {};
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        Object.assign(seen, { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + GOOD + '\n```' } }] }));
      });
    });
    await new Promise((r) => server.listen(0, r));
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    try {
      const summarizer = createSummarizer({ provider: 'openai', apiKey: 'free-key', baseUrl, model: 'llama-test' });
      expect(summarizer.enabled).toBe(true);
      const app = createApp({ summarizer });
      await bootstrap(app);
      const res = await request(app).post(`/api/posts/${postId}/summary`).set(authed(token));
      expect(res.status).toBe(200);
      expect(res.body.summary.sentiment).toBe('positive');
      expect(seen.url).toBe('/v1/chat/completions');
      expect(seen.auth).toBe('Bearer free-key');
      expect(seen.body.model).toBe('llama-test');
      expect(seen.body.messages[0].role).toBe('system');
      expect(seen.body.messages[1].content).toMatch(/<thread>/);
    } finally {
      server.close();
    }
  });

  test('a provider without a key is disabled', () => {
    expect(createSummarizer({ provider: 'openai', apiKey: null, model: 'm' }).enabled).toBe(false);
    expect(createSummarizer({ provider: null }).enabled).toBe(false);
  });
});

describe('insights', () => {
  test('returns totals, KPIs, filled daily series and rankings', async () => {
    const app = createApp({ summarizer: createSummarizer({}) });
    await bootstrap(app);
    const bob = await request(app).post('/api/auth/register').send({ username: 'dave', email: 'd@t.dev', password: 'password123' });
    await request(app).post('/api/posts').set(authed(bob.body.token)).send({ title: 'Quiet post', body: 'Nobody replies.' });

    const res = await request(app).get('/api/insights');
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ users: 2, posts: 2, comments: 1, likes: 1 });
    expect(res.body.kpis.engagementRate).toBe(0.5); // 1 of 2 posts has activity
    expect(res.body.kpis.commentsPerPost).toBe(0.5);
    expect(res.body.daily).toHaveLength(30);
    const today = res.body.daily[29];
    expect(today.posts).toBe(2);
    expect(today.comments).toBe(1);
    expect(res.body.topPosts[0]).toMatchObject({ title: 'Testing tips', likes: 1, comments: 1, engagement: 2 });
    expect(res.body.topAuthors[0]).toMatchObject({ username: 'carol', rank: 1, engagement: 2 });
    expect(res.body.topAuthors[1]).toMatchObject({ username: 'dave', rank: 2, engagement: 0 });
  });

  test('empty database yields zeros, not NaN', async () => {
    const app = createApp({ summarizer: createSummarizer({}) });
    await sequelize.sync({ force: true });
    const res = await request(app).get('/api/insights');
    expect(res.body.kpis).toEqual({ engagementRate: 0, commentsPerPost: 0, likesPerPost: 0, postsPerUser: 0 });
    expect(res.body.topPosts).toEqual([]);
  });

  test('CSV export is well formed', async () => {
    const app = createApp({ summarizer: createSummarizer({}) });
    const res = await request(app).get('/api/insights/export.csv');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('day,posts,comments');
    expect(lines).toHaveLength(31);
  });
});

describe('api docs', () => {
  const app = createApp({ summarizer: createSummarizer({}) });

  test('serves the OpenAPI spec covering every route', async () => {
    const spec = (await request(app).get('/api/openapi.json')).body;
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register', '/auth/login', '/auth/me', '/posts', '/posts/{id}', '/posts/{id}/like',
        '/posts/{id}/comments', '/posts/{id}/summary', '/comments/{id}', '/insights', '/insights/export.csv', '/health',
      ])
    );
  });

  test('serves Swagger UI with a CSP scoped to the docs route', async () => {
    const page = await request(app).get('/api/docs/');
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/swagger-ui-dist@[\d.]+\/swagger-ui-bundle\.js/);
    expect(page.headers['content-security-policy']).toMatch(/script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
    expect((await request(app).get('/api/docs/init.js')).status).toBe(200);
    // the rest of the API keeps helmet's strict default policy
    const other = await request(app).get('/api/health');
    expect(other.headers['content-security-policy']).not.toMatch(/jsdelivr/);
  });
});
