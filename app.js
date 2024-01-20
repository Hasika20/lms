/*eslint-disable no-undef */
const express = require("express");
const path = require("path");
const app = express();

// const passport = require("passport");
// const connnectEnsureLogin = require("connect-ensure-login");
// const session = require("express-session");
// const LocalStrategy = require("passport-local");
// const bcrypt = require("bcrypt");
// const flash = require("connect-flash");

// const saltRounds = 10;

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
// Serve static files from the 'public' directory
app.use(express.static("public"));
app.use(flash());
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

app.post("/tusers", async (request, response) => {
  if (request.body.email.length == 0) {
    // request.flash("error", "Email can not be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.firstName.length == 0) {
    // request.flash("error", "First name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.lastName.length == 0) {
    // request.flash("error", "Last name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.password.length < 8) {
    // request.flash("error", "Password must be at least 8 characters");
    return response.redirect("/edusignup");
  }

  //have to create a user
  console.log(request.user);
  try {
    const user = await Teachers.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: request.body.password,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/courses");
    });
  } catch (error) {
    console.log(error);
  }
});

app.post("/susers", async (request, response) => {
  if (request.body.email.length == 0) {
    // request.flash("error", "Email can not be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.firstName.length == 0) {
    // request.flash("error", "First name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.lastName.length == 0) {
    // request.flash("error", "Last name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.password.length < 8) {
    // request.flash("error", "Password must be at least 8 characters");
    return response.redirect("/edusignup");
  }

  //have to create a user
  console.log(request.user);
  try {
    const user = await Students.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: request.body.password,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/courses");
    });
  } catch (error) {
    console.log(error);
  }
});

app.get("/courses", async (request, response) => {
  response.render("courses", {
    title: "Courses",
  });
});
module.exports = app;
