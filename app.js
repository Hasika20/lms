/*eslint-disable no-undef */
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
// Serve static files from the 'public' directory
app.use(express.static("public"));

app.set("view engine", "ejs");

// Routes
app.get("/", async (request, response) => {
  // for non-logged-in users
  response.render("index", {
    title: "LMS app",
  });
});

app.get("/edusignup", (_request, response) => {
  response.render("edusignup", {
    title: "Educator Signup",
  });
});

app.get("/stusignup", (_request, response) => {
  response.render("stusignup", {
    title: "Student Signup",
  });
});

app.get("/edulogin", (_request, response) => {
  response.render("edulogin", {
    title: "Educator Login",
  });
});

app.get("/stulogin", (_request, response) => {
  response.render("stulogin", {
    title: "Student Login",
  });
});

app.get("/login", (_req, res) => {
  res.send("Login page here");
});

module.exports = app;
