"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Chapters extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      // define association here
    }
  }
  Chapters.init(
    {
      chapterName: DataTypes.STRING,
      chapterDescription: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Chapters",
    },
  );
  return Chapters;
};
