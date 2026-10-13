module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    'Comment',
    { body: { type: DataTypes.STRING(1000), allowNull: false } },
    { tableName: 'comments', underscored: true }
  );

  Comment.associate = (m) => {
    Comment.belongsTo(m.User, { as: 'author', foreignKey: { name: 'userId', allowNull: false } });
    Comment.belongsTo(m.Post, { foreignKey: { name: 'postId', allowNull: false } });
  };

  return Comment;
};
