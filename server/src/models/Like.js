module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define(
    'Like',
    {},
    {
      tableName: 'likes',
      underscored: true,
      updatedAt: false,
      indexes: [{ unique: true, fields: ['user_id', 'post_id'] }],
    }
  );

  Like.associate = (m) => {
    Like.belongsTo(m.User, { foreignKey: { name: 'userId', allowNull: false } });
    Like.belongsTo(m.Post, { foreignKey: { name: 'postId', allowNull: false } });
  };

  return Like;
};
