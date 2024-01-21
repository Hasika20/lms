/*eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
var csrf = require("tiny-csrf");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
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
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
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

const { Users, Courses, Chapters, Pages, Enrollments } = require("./models");

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
    csrfToken: request.csrfToken(),
  });
});

app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Signup",
    csrfToken: request.csrfToken(),
  });
});

app.get("/login", (request, response) => {
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});

// app.get("/login", (_req, res) => {
//   res.send("Login page here");
// });

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

app.get(
  "/teacher-dashboard",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const currentUser = request.user;

    try {
      // Fetch the existing courses from the database
      const existingCourses = await Courses.findAll();
      const existingUsers = await Users.findAll();
      const existingEnrollments = await Enrollments.findAll();

      // Render the teacher-dashboard page and pass the courses to it
      response.render("teacher-dashboard", {
        title: `${currentUser.firstName} teacher Dashboard`,
        courses: existingCourses,
        users: existingUsers,
        enrols: existingEnrollments,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(422).json(error);
    }
  },
);

app.get(
  "/createcourse",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const currentUser = await Users.findByPk(request.user.id);
    response.render("createCourse", {
      title: "Create New Course",
      currentUser,
      csrfToken: request.csrfToken(),
    });
  },
);

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
      response.redirect("/teacher-dashboard"); // You can redirect to the teacher's dashboard
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
        title: `${currentUser.firstName}'s Courses`,
        courses: userCourses,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ message: "Internal server error" });
    }
  },
);

app.get(
  "/view-report",
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
      response.render("viewReport", {
        title: `${currentUser.firstName}'s Courses Report`,
        courses: userCourses,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ message: "Internal server error" });
    }
  },
);

app.get("/view-course/:id", async (request, response) => {
  try {
    const courseId = request.params.id;
    console.log("course id: ", courseId);
    // Fetch the course details based on the courseId
    const course = await Courses.findByPk(courseId);
    const userofCourse = await Users.findByPk(course.userId);

    const currentUserId = request.query.currentUserId;
    const currentUser = await Users.findByPk(decodeURIComponent(currentUserId));

    // console.log("Current User id: ", currentUser.id);
    // console.log("User id: ", userofCourse.id);

    // Fetch chapters associated with the course
    const chapters = await Chapters.findAll({ where: { courseId } });

    if (!course) {
      // Handle cases where the course is not found
      return response.status(404).json({ message: "Course not found" });
    }

    // console.log(user)
    // Render the course details template and pass the course details and number of students enrolled to it
    response.render("course-details", {
      title: "Course Details",
      course,
      chapters,
      userofCourse,
      currentUser,
      csrfToken: request.csrfToken(),
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: "Internal server error" });
  }
});

app.get(
  "/view-course/:id/createchapter",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const courseId = request.params.id;
    const course = await Courses.findByPk(courseId);
    const userOfCourseId = course.userId;
    const userOfCourse = await Users.findByPk(userOfCourseId);

    const currentUserId = request.query.currentUserId;
    const currentUser = await Users.findByPk(decodeURIComponent(currentUserId));

    response.render("createChapter", {
      title: "Create New Chapter",
      courseId,
      course,
      userOfCourse,
      currentUser,
      csrfToken: request.csrfToken(),
    });
  },
);

app.post(
  "/view-course/:id/createchapter",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const courseId = request.body.courseId;

    // Check if the course fields provided in the request body are not empty
    if (request.body.chapterName.length == 0) {
      request.flash("error", "Chapter name cannot be empty!");
      return response.redirect(
        `/view-course/${request.body.courseId}?currentUserId=${request.query.currentUserId}`,
      );
    }

    if (request.body.chapterDescription.length == 0) {
      request.flash("error", "Description cannot be empty!");
      return response.redirect(
        `/view-course/${request.body.courseId}?currentUserId=${request.query.currentUserId}`,
      );
    }

    try {
      // Create a new chapter and insert it into the database
      await Chapters.create({
        chapterName: request.body.chapterName,
        chapterDescription: request.body.chapterDescription,
        courseId,
      });

      response.redirect(
        `/view-course/${request.body.courseId}?currentUserId=${request.query.currentUserId}`,
      );
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  },
);

app.get(
  "/view-chapter/:id/createpage",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const chapterId = request.params.id;
    const chapter = await Chapters.findByPk(chapterId);
    const courseId = chapter.courseId;
    const course = await Courses.findByPk(courseId);
    const userOfCourseId = course.userId;
    const userOfCourse = await Users.findByPk(userOfCourseId);

    const currentUserId = request.query.currentUserId;
    const currentUser = await Users.findByPk(decodeURIComponent(currentUserId));

    const pages = await Pages.findAll({ where: { chapterId } });

    response.render("createPage", {
      title: "Create New Page",
      chapterId,
      chapter,
      pages,
      course,
      userOfCourse,
      currentUser,
      csrfToken: request.csrfToken(),
    });
  },
);

app.post(
  "/view-chapter/:id/createpage",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // const chapter = await Chapters.findByPk(request.body.chapterId);

    // Check if the page fields provided in the request body are not empty
    if (request.body.pageName.length == 0) {
      request.flash("error", "Page name cannot be empty!");
      return response.redirect(
        `/view-chapter/${request.body.chapterId}/createpage?currentUserId=${request.query.currentUserId}`,
      );
    }

    if (request.body.pageContent.length == 0) {
      request.flash("error", "Page content cannot be empty!");
      return response.redirect(
        `/view-chapter/${request.body.chapterId}/createpage?currentUserId=${request.query.currentUserId}`,
      );
    }

    try {
      // Create a new page and insert it into the database
      await Pages.create({
        title: request.body.pageName,
        content: request.body.pageContent,
        chapterId: request.body.chapterId,
      });

      // Redirect back to the chapter's view page
      response.redirect(
        `/view-chapter/${request.body.chapterId}/createpage?currentUserId=${request.query.currentUserId}`,
      );
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  },
);

app.get(
  "/student-dashboard",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const currentUser = request.user;

    try {
      // Fetch the existing courses, users, enrollments from the database
      const existingCourses = await Courses.findAll();
      const existingUsers = await Users.findAll();
      const existingEnrollments = await Enrollments.findAll();

      // Render the teacher-dashboard page and pass the courses to it
      response.render("student-dashboard", {
        title: "Student Dashboard",
        courses: existingCourses,
        users: existingUsers,
        enrols: existingEnrollments,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(422).json(error);
    }
  },
);

app.post(
  "/enrol-course/:courseId",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // Get the courseId from the URL parameter
    const courseId = request.params.courseId;

    // Get the current user (student)
    const currentUserId = request.query.currentUserId;

    const existingEnrollment = await Enrollments.findOne({
      where: { userId: currentUserId, courseId },
    });

    if (existingEnrollment) {
      // Handle the case where the student is already enrolled
      return response
        .status(400)
        .json({ message: "You are already enrolled in this course." });
    }

    // Record the enrollment in the Enrollments model
    await Enrollments.create({
      userId: currentUserId,
      courseId,
      noOfChapCompleted: 0,
      totChapInTheCourse: 0,
    });

    response.redirect("/student-dashboard");
  },
);

//route to display enrolled courses by the student
app.get(
  "/MyCourses",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const currentUser = request.user;

    try {
      // Fetch the courses that the current user is enrolled in
      const enrolledCourses = await Enrollments.findAll({
        where: { userId: currentUser.id },
      });

      // Fetch information about these courses from the Courses model
      const courseIds = enrolledCourses.map(
        (enrollment) => enrollment.courseId,
      );
      const courses = await Courses.findAll({ where: { id: courseIds } });

      // Render the stuMyCourses page and pass the enrolled courses to it
      response.render("stuMyCourses", {
        title: `${currentUser.firstName}'s Enrolled Courses`,
        courses: courses,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(422).json(error);
    }
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

//delete a course
app.delete(
  "/courses/:id",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // const loggedInUser = request.user.id;
    console.log("We have to delete a course with ID: ", request.params.id);

    try {
      const status = await Courses.remove(request.params.id);
      return response.json(status ? true : false);
    } catch (err) {
      return response.status(422).json(err);
    }
  },
);

module.exports = app;
