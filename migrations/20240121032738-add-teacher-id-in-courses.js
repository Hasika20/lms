/*eslint-disable no-unused-vars*/
"use strict";

const { query } = require("express");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Courses", "teacherId", {
      type: Sequelize.DataTypes.INTEGER,
    });

    await queryInterface.addConstraint("Courses", {
      fields: ["teacherId"],
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
    await queryInterface.removeColumn("Courses", "teacherId");
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
