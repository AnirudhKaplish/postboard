module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    'Post',
    {
      title: { type: DataTypes.STRING(120), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: 'posts', underscored: true }
  );

  Post.associate = (m) => {
    Post.belongsTo(m.User, { as: 'author', foreignKey: { name: 'userId', allowNull: false } });
    Post.hasMany(m.Comment, { foreignKey: { name: 'postId', allowNull: false }, onDelete: 'CASCADE' });
    Post.hasMany(m.Like, { foreignKey: { name: 'postId', allowNull: false }, onDelete: 'CASCADE' });
  };

  return Post;
};
