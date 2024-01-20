/*eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");

const saltRounds = 10;

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(flash());

// Configure session middleware
app.use(
  session({
    secret: "my-super-secret-key-23487623476321414726",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.set("view engine", "ejs");

const { Teachers, Students } = require("./models");

// Passport.js setup
app.use(passport.initialize());
app.use(passport.session());
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

// Passport.js LocalStrategy for Teacher login
passport.use(
  "teacher-local",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      Teachers.findOne({ where: { email: email } })
        .then(async (teacher) => {
          if (!teacher) {
            return done(null, false, { message: "Teacher not found" });
          }
          const result = await bcrypt.compare(password, teacher.password);
          if (result) {
            return done(null, teacher);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch((error) => {
          return done(error);
        });
    },
  ),
);

// Passport.js LocalStrategy for Student login
passport.use(
  "student-local",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      Students.findOne({ where: { email: email } })
        .then(async (student) => {
          if (!student) {
            return done(null, false, { message: "Student not found" });
          }
          const result = await bcrypt.compare(password, student.password);
          if (result) {
            return done(null, student);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch((error) => {
          return done(error);
        });
    },
  ),
);

// Passport.js Serialization and Deserialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  Teachers.findByPk(id)
    .then((teacher) => {
      if (teacher) {
        return done(null, teacher);
      } else {
        Students.findByPk(id)
          .then((student) => {
            done(null, student);
          })
          .catch((error) => {
            done(error);
          });
      }
    })
    .catch((error) => {
      done(error);
    });
});

// Routes
app.get("/", (request, response) => {
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
  // Similar to your teacher registration route
  // You can use passport.authenticate after registration to log in the teacher
  if (request.body.email.length == 0) {
    request.flash("error", "Email can not be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.firstName.length == 0) {
    request.flash("error", "First name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.lastName.length == 0) {
    request.flash("error", "Last name cannot be empty!");
    return response.redirect("/edusignup");
  }

  if (request.body.password.length < 8) {
    request.flash("error", "Password must be at least 8 characters");
    return response.redirect("/edusignup");
  }

  //hashing the password
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);

  //have to create a user
  // console.log(request.user);
  try {
    const teacher = await Teachers.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(teacher, (err) => {
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
  // Similar to your student registration route
  // You can use passport.authenticate after registration to log in the student
  if (request.body.email.length == 0) {
    request.flash("error", "Email can not be empty!");
    return response.redirect("/stusignup");
  }

  if (request.body.firstName.length == 0) {
    request.flash("error", "First name cannot be empty!");
    return response.redirect("/stusignup");
  }

  if (request.body.lastName.length == 0) {
    request.flash("error", "Last name cannot be empty!");
    return response.redirect("/stusignup");
  }

  if (request.body.password.length < 8) {
    request.flash("error", "Password must be at least 8 characters");
    return response.redirect("/stusignup");
  }

  //hashing the password
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);

  //have to create a user
  // console.log(request.user);
  try {
    const Student = await Students.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(Student, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/courses");
    });
  } catch (error) {
    console.log(error);
  }
});

app.post(
  "/loggingteacher",
  passport.authenticate("teacher-local", {
    failureRedirect: "/edulogin", // Redirect to login page on failure
    failureFlash: true, // Enable flash messages for failure
  }),
  (request, response) => {
    // Authentication was successful
    // You can now redirect the authenticated educator to their dashboard or another page
    response.redirect("/courses");
  },
);

app.post(
  "/loggingstudent",
  passport.authenticate("student-local", {
    failureRedirect: "/stulogin", // Redirect to login page on failure
    failureFlash: true, // Enable flash messages for failure
  }),
  (request, response) => {
    // Authentication was successful
    // You can now redirect the authenticated educator to their dashboard or another page
    response.redirect("/student-dashboard");
  },
);

app.get("/courses", (request, response) => {
  response.render("courses", {
    title: "Courses",
  });
});

app.get("/student-dashboard", (request, response) => {
  response.render("student-dashboard", {
    title: "Student Dashboard",
  });
});

module.exports = app;
