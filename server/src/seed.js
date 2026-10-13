// Populates the database with demo data: `npm run seed`
const bcrypt = require('bcryptjs');
const { sequelize, User, Post, Comment, Like } = require('./db');

(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await bcrypt.hash('password123', 10);
  await User.bulkCreate(
    [
      { username: 'ada', email: 'ada@example.com', passwordHash },
      { username: 'linus', email: 'linus@example.com', passwordHash },
      { username: 'grace', email: 'grace@example.com', passwordHash },
    ]
  );
  const users = await User.findAll({ order: [['id', 'ASC']] });
  const [u1, u2, u3] = users;

  const posts = await Post.bulkCreate([
    { title: 'Welcome to Postboard', body: 'A tiny community board. Sign up, write a post, and start a conversation.\n\nLog in with ada / password123 to try it out.', userId: u1.id },
    { title: 'What are you building this week?', body: 'Share what you are working on, however small. Side projects, learning goals, bug hunts: all welcome.', userId: u2.id },
    { title: 'Debugging tip: shrink the problem', body: 'When something breaks, delete code until the bug disappears. The last thing you deleted is the culprit.', userId: u3.id },
    { title: 'Favourite developer tools?', body: 'I keep coming back to a good terminal, a fast editor and a decent test runner. What is in your toolbox?', userId: u1.id },
  ]);
  const ps = await Post.findAll({ order: [['id', 'ASC']] });
  await Comment.bulkCreate([
    { body: 'Glad to be here!', postId: ps[0].id, userId: u2.id },
    { body: 'A CLI for my budget tracker.', postId: ps[1].id, userId: u3.id },
    { body: 'Rubber duck debugging works for me too.', postId: ps[2].id, userId: u1.id },
  ]);
  await Like.bulkCreate([
    { postId: ps[0].id, userId: u2.id },
    { postId: ps[0].id, userId: u3.id },
    { postId: ps[2].id, userId: u1.id },
  ]);
  console.log('Seeded 3 users (password: password123), 4 posts.');
  await sequelize.close();
})();
