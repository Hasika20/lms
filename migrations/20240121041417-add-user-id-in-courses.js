/*eslint-disable no-unused-vars*/
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Courses", "userId", {
      type: Sequelize.DataTypes.INTEGER,
    });

    await queryInterface.addConstraint("Courses", {
      fields: ["userId"],
      type: "foreign key",
      references: {
        table: "Users",
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
    await queryInterface.removeColumn("Courses", "userId");
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
