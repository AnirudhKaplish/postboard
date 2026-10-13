require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env'), quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set in production');
  }
  jwtSecret = 'dev-only-insecure-secret';
}

module.exports = {
  env,
  isProd,
  isServerless,
  port: Number(process.env.PORT) || 3001,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Optional AI summaries. Pick ONE provider; with no key the feature is hidden.
  //  - AI_API_KEY: any OpenAI-compatible API. Free tiers exist (Groq, Google Gemini, OpenRouter).
  //  - ANTHROPIC_API_KEY: Anthropic API (paid).
  ai: process.env.AI_API_KEY
    ? {
        provider: 'openai',
        apiKey: process.env.AI_API_KEY,
        baseUrl: (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      }
    : process.env.ANTHROPIC_API_KEY
      ? { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5' }
      : { provider: null, apiKey: null, model: null },
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    // Set DATABASE_URL (e.g. mysql://user:pass@host:3306/postboard) to use MySQL.
    // (Postgres: postgres://user:pass@host/db?sslmode=require). Otherwise a local SQLite file is used, so the app runs with zero setup.
    url: process.env.DATABASE_URL || null,
    sqlitePath:
      env === 'test'
        ? ':memory:'
        : process.env.SQLITE_PATH ||
          require('path').join(__dirname, '..', 'data', 'postboard.sqlite'),
  },
};
