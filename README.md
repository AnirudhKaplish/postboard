# Postboard

A small, full-stack community board. People sign up, publish posts, like them and talk in the comments.
Built with **React 19**, **Express 5**, **Sequelize** and **JWT** auth. It runs with zero setup on SQLite locally and
switches to Postgres (free on Neon) with a single environment variable. It deploys to Vercel's free tier.

[![CI](https://github.com/AnirudhKaplish/postboard/actions/workflows/ci.yml/badge.svg)](https://github.com/AnirudhKaplish/postboard/actions/workflows/ci.yml)

## Features

- Account registration and login (bcrypt-hashed passwords, JWT bearer tokens)
- Create, edit and delete your own posts; ownership is enforced on the server
- Comments (add, delete your own) and one-click likes
- **AI thread summaries**: key points, open questions and tone, via any OpenAI-compatible API (free tiers on Groq, Gemini, OpenRouter) or Anthropic; cached, rate limited, and hidden when no key is set
- **Insights dashboard**: engagement KPIs, 30-day activity chart, top posts and an author leaderboard built from SQL aggregations and a window function, plus CSV export
- **Interactive API docs** (OpenAPI 3 + Swagger UI) at `/api/docs`
- Search, newest/popular sorting, per-author filtering and pagination
- Validation on both sides (zod on the API, Formik + Yup in the UI) with field-level errors
- Security basics: helmet, CORS allow-list, auth rate limiting, request size limits, no secrets in the repo
- Light and dark theme, responsive layout, keyboard-accessible controls
- Tests for the API (Jest + Supertest) and the UI (Vitest + Testing Library), CI on GitHub Actions
- One-click free deployment (Vercel + Neon), Docker image, and a compose file with Postgres
- CI runs the whole test suite against both SQLite and Postgres

## Quick start

Requires Node.js 22.13 or newer (the API uses the built-in `node:sqlite`, so there is nothing to compile or download).

```bash
git clone https://github.com/AnirudhKaplish/postboard.git
cd postboard
npm run install:all
npm run seed      # optional demo data (users ada / linus / grace, password: password123)
npm run dev       # API on :3001, web app on http://localhost:5173
```

No database server is needed: data lives in `server/data/postboard.sqlite`.

## Configuration

Copy `.env.example` to `.env` in the project root. All values are optional in development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `JWT_SECRET` | dev-only fallback | **Required in production.** Signs auth tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origin allowed by CORS |
| `DATABASE_URL` | empty (SQLite) | e.g. `postgres://user:pass@host/db?sslmode=require` |
| `AI_API_KEY` | empty | Optional. Key for an OpenAI-compatible provider; enables AI summaries |
| `AI_BASE_URL` / `AI_MODEL` | Groq / `llama-3.3-70b-versatile` | Provider endpoint and model |
| `ANTHROPIC_API_KEY` | empty | Optional paid alternative to `AI_API_KEY` |
| `SQLITE_PATH` | `server/data/postboard.sqlite` | SQLite file location |

## Deploy for free (GitHub + Vercel + Neon)

Everything below has a free tier and needs no credit card at the time of writing (check each provider's current terms).

**1. Push the project to GitHub** (a public repo also gets free GitHub Actions for CI).

**2. Create a free Postgres database on [Neon](https://neon.tech).** Vercel has no persistent disk, so the SQLite file used
locally cannot hold production data. In Neon, create a project and copy the **connection string**
(it looks like `postgres://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`). Use the *pooled* connection if offered.

**3. Import the repo on [Vercel](https://vercel.com/new).** Leave the framework preset on "Other". `vercel.json` already sets the
install and build commands, serves the React build as static files, and routes `/api/*` to the Express app as a serverless function.

**4. Add environment variables** in the Vercel project settings (Settings > Environment Variables):

| Name | Value |
| --- | --- |
| `JWT_SECRET` | a long random string (see `.env.example` for a one-liner) |
| `DATABASE_URL` | your Neon connection string |
| `AI_API_KEY` | *(optional)* a free key from [Groq](https://console.groq.com) or [Google AI Studio](https://aistudio.google.com) |
| `AI_BASE_URL`, `AI_MODEL` | *(optional)* only if you do not use Groq's default; see `.env.example` |

**5. Deploy.** Tables are created automatically on the first request. To load demo data into the hosted database, run once from your computer:

```bash
# macOS / Linux
DATABASE_URL="postgres://..." npm run seed
# Windows (PowerShell)
$env:DATABASE_URL="postgres://..."; npm run seed
```

(`seed` wipes the tables first, so only run it on an empty or throwaway database. Putting `DATABASE_URL` in your local `.env` file works too.)

**6. Open your `*.vercel.app` URL.** Every push to `main` redeploys automatically.

Notes on the free tier:
- Vercel's free (Hobby) plan is for personal, non-commercial projects, which fits a portfolio.
- Rate limiting is in-memory, so on serverless it applies per warm instance rather than globally. Fine for a demo; use a shared store such as Redis for real traffic.
- The first request after a quiet period is slower (cold start). Neon may also pause idle databases and wake them on demand.
- GitHub Pages cannot host this app, because it only serves static files and the app needs a backend. Vercel serves the frontend and the API together.

### Other ways to run it

```bash
npm run build                  # builds client/dist
NODE_ENV=production JWT_SECRET=... npm start   # the API also serves the built client
```

Or self-host with Docker (app + Postgres): `JWT_SECRET=... docker compose up --build`, then open http://localhost:3001.

## API

All routes are under `/api`. Send `Authorization: Bearer <token>` for protected routes.

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | | Create an account, returns `{ token, user }` |
| `POST` | `/auth/login` | | Log in with username or email |
| `GET` | `/auth/me` | yes | Current user |
| `GET` | `/posts?q=&sort=new\|popular&page=&limit=&author=` | optional | Paginated list |
| `GET` | `/posts/:id` | optional | One post (includes `likedByMe` when logged in) |
| `POST` | `/posts` | yes | Create a post `{ title, body }` |
| `PUT` | `/posts/:id` | owner | Update a post |
| `DELETE` | `/posts/:id` | owner | Delete a post with its comments and likes |
| `POST` | `/posts/:id/like` | yes | Toggle like, returns `{ liked, likeCount }` |
| `GET` | `/posts/:id/comments` | | List comments |
| `POST` | `/posts/:id/comments` | yes | Add a comment `{ body }` |
| `DELETE` | `/comments/:id` | owner | Delete a comment |
| `POST` | `/posts/:id/summary` | yes | AI summary of the thread (needs an AI key) |
| `GET` | `/insights` | | Community analytics |
| `GET` | `/insights/export.csv` | | Daily activity as CSV |
| `GET` | `/health` | | Liveness check (`aiEnabled` tells the client whether summaries are available) |

Interactive docs with a built-in "Try it out" are served at `/api/docs` (spec at `/api/openapi.json`).

Errors are JSON: `{ "error": "message", "fields": { "title": "..." } }`.

## Project structure

```
api/                 Vercel serverless entry point
server/
  src/
    app.js         Express app (middleware, routes, static client)
    index.js       Entry point
    config.js      Environment configuration
    db.js          Sequelize setup (SQLite locally, Postgres in production)
    models/        User, Post, Comment, Like
    routes/        auth, posts, comments
    middleware/    auth (JWT), validate (zod)
    schemas.js     Request validation schemas
    openapi.js     OpenAPI 3 specification
    services/      AI summarizer (OpenAI-compatible or Anthropic)
    sqlite-driver.js  node:sqlite adapter for Sequelize
    seed.js        Demo data
  tests/           API integration tests
client/
  src/
    pages/         Home, PostDetail, PostEditor, Insights, Login/Register
    components/    Navbar, PostCard, Comments, Pagination
    auth.jsx       Auth context
    api.js         Axios instance and error parsing
```

## Documentation

- [Product requirements](docs/PRD.md)
- [User stories and acceptance criteria](docs/USER_STORIES.md)
- [Case study: decisions, data model, KPIs](docs/CASE_STUDY.md)

## Tests

```bash
npm test                                   # SQLite, no setup
DATABASE_URL=postgres://... npm --prefix server test   # against Postgres (CI does both)
```

## Roadmap ideas

Tags and topic analysis, image uploads, markdown rendering, email verification, refresh tokens in httpOnly cookies, a moderation role.

## License

MIT
