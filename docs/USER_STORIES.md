# User stories and acceptance criteria

Format: *As a (persona), I want (capability) so that (benefit).* Each story links to the automated test that covers it.

## Accounts

**US-1 Sign up.** As a visitor, I want to create an account so that I can post.
- Username 3 to 30 characters (letters, numbers, underscore); valid email; password at least 8 characters.
- Duplicate username or email shows a field-level error.
- On success I am logged in and returned to the board.
- Tests: `auth › registers, rejects duplicates…`, client `register form validates…`

**US-2 Log in and out.** As a member, I want to log in with my username or email so that I can return later.
- Wrong credentials show one generic error (no hint about which part was wrong).
- Protected pages send anonymous users to the login page and bring them back afterwards.
- Tests: `auth › rejects bad credentials…`, client `protected routes redirect…`

## Posts

**US-3 Publish.** As a member, I want to write a post with a title and body so that I can start a discussion.
- Title 3 to 120 characters, body up to 10,000.
- The server rejects invalid input even if the client is bypassed.
- Test: `posts › validates input`, `creates and fetches a post`

**US-4 Manage my posts.** As an author, I want to edit or delete my post so that I can fix mistakes.
- Only the author can edit or delete (403 otherwise).
- Deleting removes the post's comments and likes.
- Tests: `only the owner can edit or delete`, `deleting a post removes…`

**US-5 Find posts.** As a reader, I want to search, sort and page through posts so that I can find relevant discussion.
- Search matches title and body; sort by newest or most liked; 9 posts per page by default; filter by author.
- Test: `lists with search, pagination and sorting`

## Engagement

**US-6 React.** As a member, I want to like a post (and undo it) so that I can show appreciation cheaply.
- One like per member per post; counts update immediately; anonymous users are sent to log in.
- Test: `likes toggle…`

**US-7 Discuss.** As a member, I want to comment on a post and delete my own comments so that I can join the conversation.
- Comments are 1 to 1,000 characters, oldest first; only the author can delete.
- Test: `comments: create, list, count, owner-only delete`

## AI and analytics

**US-8 Catch up fast.** As a busy reader, I want a summary of a thread so that I do not have to read every comment.
- Button appears only when the server has an API key and I am logged in.
- Summary shows a short recap, key points, open questions and overall tone, labelled as AI generated.
- Repeated requests for an unchanged thread are served from cache; a new comment invalidates it.
- Provider failures show a clear error, not a crash.
- Tests: `AI summary › …` (uses a fake client; no real API calls in CI)

**US-9 Understand community health.** As an organizer, I want an Insights page so that I can see whether the community is thriving.
- Shows totals, engagement rate, comments and likes per post, posts per member.
- Shows a 30-day activity chart with zero-filled days, top posts and a ranked author leaderboard.
- I can export daily activity as CSV (formula-injection safe).
- An empty database shows zeros, never `NaN`.
- Tests: `insights › …`

## Developers

**US-10 Integrate.** As a developer, I want interactive API documentation so that I can try the API without reading the code.
- `/api/docs` serves Swagger UI backed by `/api/openapi.json`; every route is listed.
- Test: `api docs › …`
