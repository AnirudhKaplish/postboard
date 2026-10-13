# Postboard: Product Requirements Document

| | |
| --- | --- |
| Status | v1.0 shipped, v1.1 (AI + analytics) shipped |
| Owner | Archi |

## 1. Problem

Small communities (a college club, a study group, a project team) need a place for short, searchable,
threaded discussion. Chat tools bury old answers; forums are heavy to set up and moderate. Organizers also
have no simple way to tell whether the community is healthy or quietly dying.

## 2. Target users

| Persona | Needs |
| --- | --- |
| **Member** | Post a question or idea, find earlier answers, react and reply with minimal friction |
| **Organizer** | See at a glance whether people are participating, who drives discussion, and what topics land |
| **Busy reader** | Catch up on a long thread in seconds without reading every comment |

## 3. Goals and non-goals

**Goals**
1. Anyone can sign up and publish a post in under a minute.
2. Discussion is easy to find (search, sort, per-author filter).
3. Long threads can be summarized on demand.
4. Organizers get a trustworthy, SQL-backed view of community health.

**Non-goals (v1.x):** private groups, direct messages, image uploads, email notifications, native mobile apps.

## 4. Scope

| Area | Requirement | Priority |
| --- | --- | --- |
| Accounts | Register, log in, stay logged in; passwords stored hashed | Must |
| Posts | Create, edit, delete own posts; list with search, sort, pagination | Must |
| Engagement | Like toggle, comments, delete own comments | Must |
| AI summary | One-click summary with key points, tone and open questions; cached; disabled cleanly if no key | Should |
| Insights | Totals, KPIs, 30-day activity chart, top posts, author leaderboard, CSV export | Should |
| API docs | Interactive OpenAPI documentation | Should |
| Security | Server-side ownership checks, validation, rate limiting, no secrets in repo | Must |

## 5. Success metrics

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Engagement rate | Posts with at least one like or comment / all posts | Are posts getting any response? |
| Comments per post | Total comments / total posts | Depth of discussion |
| Posts per member | Total posts / registered members | Spread of contribution vs. a few heavy posters |
| Daily active contribution | Posts + comments per day | Momentum and trend |
| Summary usage (future) | Summaries requested / thread views on long threads | Is the AI feature used where it should be? |

All of the first four are computed by `GET /api/insights` and shown on the Insights page.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| AI summary is wrong or manipulated by hostile post text | Thread is passed as delimited untrusted data; system prompt forbids following embedded instructions; UI labels output as AI-generated |
| AI cost abuse (and free-tier quota exhaustion) | Auth required, 10 requests/min limit, results cached until the thread changes, input capped at 12k characters |
| Credential stuffing | Rate limit on auth routes, bcrypt hashing, generic login error |
| Spam | Out of scope for v1.x; moderation role listed as a next step |
| Data loss when hosted on a platform without persistent disk (e.g. Vercel) | Use hosted Postgres (free on Neon) in production; SQLite is for local development only |

## 7. Release plan

1. **v1.0:** accounts, posts, comments, likes, search, pagination.
2. **v1.1:** AI summaries, Insights, OpenAPI docs, deploy blueprint.
3. **Next:** tags, markdown, moderation role, email notifications, refresh-token cookies.
