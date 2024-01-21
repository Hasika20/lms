/*eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const connnectEnsureLogin = require("connect-ensure-login");
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

const { Users, Courses } = require("./models");

// Passport.js setup
app.use(passport.initialize());
app.use(passport.session());
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

// Passport.js LocalStrategy for login
passport.use(
  "local",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      Users.findOne({ where: { email: email } })
        .then(async (user) => {
          if (!user) {
            return done(null, false, { message: "User not found" });
          }
          const result = await bcrypt.compare(password, user.password);

          if (!result) {
            return done(null, false, { message: "Invalid password" });
          }

          if (user.role === "teacher") {
            return done(null, user, { role: "teacher" });
          } else if (user.role === "student") {
            return done(null, user, { role: "student" });
          } else {
            return done(null, false, { message: "Unknown role" });
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
  Users.findByPk(id)
    .then((user) => {
      if (user) {
        done(null, user);
      } else {
        done(new Error("User not found"), null);
      }
    })
    .catch((error) => {
      done(error, null);
    });
});

app.set("view engine", "ejs");

// Routes
app.get("/", (request, response) => {
  response.render("index", {
    title: "LMS app",
  });
});

app.get("/signup", (_request, response) => {
  response.render("signup", {
    title: "Signup",
  });
});

app.get("/login", (_request, response) => {
  response.render("login", {
    title: "Login",
  });
});

app.get("/login", (_req, res) => {
  res.send("Login page here");
});

app.post("/users", async (request, response) => {
  // Similar to your student registration route
  // You can use passport.authenticate after registration to log in the student
  if (!request.body.role) {
    request.flash("error", "Role can not be empty!");
    return response.redirect("/signup");
  }
  if (request.body.email.length == 0) {
    request.flash("error", "Email can not be empty!");
    return response.redirect("/signup");
  }

  if (request.body.firstName.length == 0) {
    request.flash("error", "First name cannot be empty!");
    return response.redirect("/signup");
  }

  if (request.body.lastName.length == 0) {
    request.flash("error", "Last name cannot be empty!");
    return response.redirect("/signup");
  }

  if (request.body.password.length < 8) {
    request.flash("error", "Password must be at least 8 characters");
    return response.redirect("/signup");
  }

  //hashing the password
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);

  //have to create a user
  // console.log(request.user);
  try {
    const User = await Users.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
      role: request.body.role,
    });
    request.login(User, (err) => {
      if (err) {
        console.log(err);
      }

      // Redirect based on the user's role
      if (User.role === "teacher") {
        response.redirect("/teacher-dashboard");
      } else if (User.role === "student") {
        response.redirect("/student-dashboard");
      } else {
        // Handle other roles or scenarios as needed
        response.redirect("/signup");
      }
    });
  } catch (error) {
    console.log(error);
  }
});

app.post(
  "/logging",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    // Authentication was successful
    if (request.user.role === "student") {
      response.redirect("/student-dashboard");
    } else if (request.user.role === "teacher") {
      response.redirect("/teacher-dashboard");
    } else {
      response.redirect("/login");
    }
  },
);

//route to fetch all existing courses
app.get(
  "/teacher-dashboard",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      // Fetch the existing courses from the database
      const existingCourses = await Courses.findAll();
      console.log(existingCourses);
      // response.send(existingCourses);

      // Render the teacher-dashboard page and pass the courses to it
      response.render("teacher-dashboard", {
        title: "Teacher Dashboard",
        courses: existingCourses, // Pass the data as "courses"
      });
    } catch (error) {
      console.error(error);
      return response.status(422).json(error);
    }
  },
);

app.get("/createcourse", connnectEnsureLogin.ensureLoggedIn(), (req, res) => {
  res.render("createCourse", { title: "Create New Course" });
});

//route for creating courses
app.post(
  "/createcourse",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // Check if the course fields provided in the request body are not empty
    if (request.body.courseName.length == 0) {
      request.flash("error", "Course name cannot be empty!");
      return response.redirect("/teacher-dashboard"); // You can redirect to the teacher's dashboard
    }

    if (request.body.courseDescription.length == 0) {
      request.flash("error", "Description cannot be empty!");
      return response.redirect("/teacher-dashboard"); // You can redirect to the teacher's dashboard
    }

    try {
      // Create a new course and insert it into the database
      await Courses.create({
        courseName: request.body.courseName,
        courseDescription: request.body.courseDescription,
        userId: request.user.id,
      });

      // Redirect to the teacher's dashboard or send a response indicating success
      response.redirect("/createcourse"); // You can redirect to the teacher's dashboard
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  },
);

app.get(
  "/my-courses",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (!request.isAuthenticated()) {
      // Ensure the user is authenticated
      return response.redirect("/login");
    }

    try {
      // Retrieve the currently logged-in user
      const currentUser = request.user;

      if (!currentUser) {
        // Handle cases where the user is not found
        return response.status(404).json({ message: "User not found" });
      }

      // Retrieve courses associated with the user
      const userCourses = await currentUser.getCourses();

      // Render the my-courses page and pass the user's courses to it
      response.render("my-courses", {
        title: "My Courses",
        courses: userCourses,
        user: currentUser,
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ message: "Internal server error" });
    }
  },
);

app.get(
  "/student-dashboard",
  connnectEnsureLogin.ensureLoggedIn(),
  (request, response) => {
    response.render("student-dashboard", {
      title: "Student Dashboard",
    });
  },
);

app.get("/signout", (request, response, next) => {
  //signout
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

module.exports = app;
