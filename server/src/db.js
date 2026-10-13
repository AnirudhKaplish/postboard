const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

const logging = false;
let sequelize;

if (config.db.url) {
  // Works for postgres:// (e.g. Neon, Supabase) and mysql:// URLs.
  // Keep the pool tiny: serverless platforms open many short-lived instances.
  // The driver is passed explicitly: Sequelize loads it with a dynamic require, which bundlers
  // (including Vercel's) cannot see, so it would otherwise be missing from the deployed function.
  const isMysql = /^mysql/i.test(config.db.url);
  sequelize = new Sequelize(config.db.url, {
    logging,
    dialectModule: isMysql ? require('mysql2') : require('pg'),
    pool: { max: config.isServerless ? 2 : 10, min: 0, idle: 5000, acquire: 20000 },
  });
} else {
  if (config.db.sqlitePath !== ':memory:') {
    fs.mkdirSync(path.dirname(config.db.sqlitePath), { recursive: true });
  }
  sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: require('./sqlite-driver'),
    storage: config.db.sqlitePath,
    logging,
  });
}

const models = {
  User: require('./models/User')(sequelize, DataTypes),
  Post: require('./models/Post')(sequelize, DataTypes),
  Comment: require('./models/Comment')(sequelize, DataTypes),
  Like: require('./models/Like')(sequelize, DataTypes),
};

Object.values(models).forEach((m) => m.associate && m.associate(models));

module.exports = { sequelize, ...models };
