const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const ok = (description, schema) => ({ description, ...(schema ? { content: json(schema) } : {}) });
const err = (description) => ({ description, content: json(ref('Error')) });
const auth = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Postboard API',
    version: '1.0.0',
    description:
      'REST API for Postboard, a small community board. Log in via `/auth/login`, then click **Authorize** and paste the token to try protected routes.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth' }, { name: 'Posts' }, { name: 'Comments' }, { name: 'AI' }, { name: 'Insights' }, { name: 'System' },
  ],
  paths: {
    '/health': {
      get: { tags: ['System'], summary: 'Liveness check', responses: { 200: ok('OK', { type: 'object', properties: { status: { type: 'string' }, aiEnabled: { type: 'boolean' } } }) } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Create an account',
        requestBody: { required: true, content: json({ type: 'object', required: ['username', 'email', 'password'], properties: { username: { type: 'string', minLength: 3, maxLength: 30 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } } }) },
        responses: { 201: ok('Account created', ref('AuthResult')), 400: err('Validation failed'), 409: err('Username or email taken') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in with username or email',
        requestBody: { required: true, content: json({ type: 'object', required: ['identifier', 'password'], properties: { identifier: { type: 'string' }, password: { type: 'string' } } }) },
        responses: { 200: ok('Logged in', ref('AuthResult')), 401: err('Invalid credentials') },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', security: auth, responses: { 200: ok('Current user', { type: 'object', properties: { user: ref('User') } }), 401: err('Not authenticated') } },
    },
    '/posts': {
      get: {
        tags: ['Posts'], summary: 'List posts',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search title and body' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['new', 'popular'], default: 'new' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 9 } },
          { name: 'author', in: 'query', schema: { type: 'string' }, description: 'Filter by username' },
        ],
        responses: { 200: ok('A page of posts', { type: 'object', properties: { posts: { type: 'array', items: ref('PostSummary') }, page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } }), 400: err('Invalid query') },
      },
      post: {
        tags: ['Posts'], summary: 'Create a post', security: auth,
        requestBody: { required: true, content: json(ref('PostInput')) },
        responses: { 201: ok('Created', { type: 'object', properties: { post: ref('Post') } }), 400: err('Validation failed'), 401: err('Not authenticated') },
      },
    },
    '/posts/{id}': {
      parameters: [idParam],
      get: { tags: ['Posts'], summary: 'Get a post', responses: { 200: ok('The post', { type: 'object', properties: { post: ref('Post') } }), 404: err('Not found') } },
      put: { tags: ['Posts'], summary: 'Update your post', security: auth, requestBody: { required: true, content: json(ref('PostInput')) }, responses: { 200: ok('Updated', { type: 'object', properties: { post: ref('Post') } }), 403: err('Not the owner'), 404: err('Not found') } },
      delete: { tags: ['Posts'], summary: 'Delete your post (and its comments and likes)', security: auth, responses: { 204: ok('Deleted'), 403: err('Not the owner'), 404: err('Not found') } },
    },
    '/posts/{id}/like': {
      parameters: [idParam],
      post: { tags: ['Posts'], summary: 'Toggle like', security: auth, responses: { 200: ok('New like state', { type: 'object', properties: { liked: { type: 'boolean' }, likeCount: { type: 'integer' } } }), 404: err('Not found') } },
    },
    '/posts/{id}/comments': {
      parameters: [idParam],
      get: { tags: ['Comments'], summary: 'List comments', responses: { 200: ok('Comments, oldest first', { type: 'object', properties: { comments: { type: 'array', items: ref('Comment') } } }), 404: err('Not found') } },
      post: { tags: ['Comments'], summary: 'Add a comment', security: auth, requestBody: { required: true, content: json({ type: 'object', required: ['body'], properties: { body: { type: 'string', maxLength: 1000 } } }) }, responses: { 201: ok('Created', { type: 'object', properties: { comment: ref('Comment') } }), 400: err('Validation failed'), 404: err('Not found') } },
    },
    '/posts/{id}/summary': {
      parameters: [idParam],
      post: { tags: ['AI'], summary: 'AI summary of a post and its discussion', description: 'Requires `ANTHROPIC_API_KEY` on the server. Results are cached until the post or its comments change. Limited to 10 requests per minute.', security: auth, responses: { 200: ok('Summary', { type: 'object', properties: { summary: ref('Summary') } }), 401: err('Not authenticated'), 404: err('Not found'), 429: err('Rate limited'), 502: err('AI provider failed'), 503: err('AI not configured') } },
    },
    '/comments/{id}': {
      parameters: [idParam],
      delete: { tags: ['Comments'], summary: 'Delete your comment', security: auth, responses: { 204: ok('Deleted'), 403: err('Not the owner'), 404: err('Not found') } },
    },
    '/insights': {
      get: { tags: ['Insights'], summary: 'Community analytics', description: 'Totals, KPIs, 30-day daily activity, top posts and a ranked author leaderboard, computed with SQL aggregations and a window function.', responses: { 200: ok('Insights', ref('Insights')) } },
    },
    '/insights/export.csv': {
      get: { tags: ['Insights'], summary: 'Daily activity as CSV', responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } } } },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, email: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
      AuthResult: { type: 'object', properties: { token: { type: 'string' }, user: ref('User') } },
      Author: { type: 'object', properties: { id: { type: 'integer', nullable: true }, username: { type: 'string' } } },
      PostInput: { type: 'object', required: ['title', 'body'], properties: { title: { type: 'string', minLength: 3, maxLength: 120 }, body: { type: 'string', maxLength: 10000 } } },
      PostSummary: { type: 'object', properties: { id: { type: 'integer' }, title: { type: 'string' }, excerpt: { type: 'string' }, author: ref('Author'), likeCount: { type: 'integer' }, commentCount: { type: 'integer' }, likedByMe: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      Post: { allOf: [ref('PostSummary'), { type: 'object', properties: { body: { type: 'string' } } }] },
      Comment: { type: 'object', properties: { id: { type: 'integer' }, body: { type: 'string' }, postId: { type: 'integer' }, author: ref('Author'), createdAt: { type: 'string', format: 'date-time' } } },
      Summary: { type: 'object', properties: { summary: { type: 'string' }, keyPoints: { type: 'array', items: { type: 'string' } }, sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] }, openQuestions: { type: 'array', items: { type: 'string' } }, model: { type: 'string' }, generatedAt: { type: 'string', format: 'date-time' }, cached: { type: 'boolean' } } },
      Insights: {
        type: 'object',
        properties: {
          totals: { type: 'object', properties: { users: { type: 'integer' }, posts: { type: 'integer' }, comments: { type: 'integer' }, likes: { type: 'integer' } } },
          kpis: { type: 'object', description: 'engagementRate = share of posts with at least one like or comment', properties: { engagementRate: { type: 'number' }, commentsPerPost: { type: 'number' }, likesPerPost: { type: 'number' }, postsPerUser: { type: 'number' } } },
          daily: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, posts: { type: 'integer' }, comments: { type: 'integer' } } } },
          topPosts: { type: 'array', items: { type: 'object' } },
          topAuthors: { type: 'array', items: { type: 'object' } },
          windowDays: { type: 'integer' },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
