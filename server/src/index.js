const config = require('./config');
const { sequelize } = require('./db');
const { createApp } = require('./app');

async function main() {
  await sequelize.authenticate();
  await sequelize.sync();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Postboard API listening on http://localhost:${config.port} (${config.env})`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
