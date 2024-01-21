/*eslint-disable no-unused-vars*/
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Chapters", "courseId", {
      type: Sequelize.DataTypes.INTEGER,
    });

    await queryInterface.addConstraint("Chapters", {
      fields: ["courseId"],
      type: "foreign key",
      references: {
        table: "Courses",
        field: "id",
      },
    });
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Chapters", "chapterId");
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
