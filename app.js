const express = require("express");
const app = express();

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the Learning Management System");
});

app.get("/login", (req, res) => {
  res.send("Login page here");
});

module.exports = app;
