module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: 'users', underscored: true }
  );

  User.associate = (m) => {
    User.hasMany(m.Post, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
    User.hasMany(m.Comment, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
    User.hasMany(m.Like, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
  };

  return User;
};
