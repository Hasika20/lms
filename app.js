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
    secret: "my-super-secret-key-16201620162016201620",
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
  if (request.isAuthenticated()) {
    if (request.user.role == "teacher") {
      return response.redirect("/teacher-dashboard");
    } else {
      return response.redirect("/student-dashboard");
    }
  }
  response.render("index", {
    title: "LMS",
    csrfToken: request.csrfToken(),
  });
});

app.get("/signup", async (request, response) => {
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

//forget password
app.get("/resetpassword", (request, reponse) => {
  reponse.render("resetPassword", {
    title: "Reset Password",
    csrfToken: request.csrfToken(),
  });
});

// Route for updating the password
app.post("/resetpassword", async (request, response) => {
  const userEmail = request.body.email;
  const newPassword = request.body.password;

  try {
    // Find the user by email
    const user = await Users.findOne({ where: { email: userEmail } });

    if (!user) {
      request.flash("error", "User with that email does not exist.");
      return response.redirect("/resetpassword");
    }

    // Hash the new password
    const hashedPwd = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password in the database
    await user.update({ password: hashedPwd });

    // Redirect to a success page or login page
    return response.redirect("/login");
  } catch (error) {
    console.log(error);
    request.flash("error", "Error updating the password.");
    return response.redirect("/resetpassword");
  }
});

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

      // Retrieve courses associated with the user
      const userCourses = await currentUser.getCourses();

      // Create an array to hold course details including enrollment count
      const coursesWithEnrollment = [];

      // Loop through each course to fetch enrollment count
      for (const course of userCourses) {
        const enrollmentCount = await Enrollments.count({
          where: { courseId: course.id },
        });

        coursesWithEnrollment.push({
          id: course.id,
          courseName: course.courseName,
          enrollmentCount: enrollmentCount,
        });
      }

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
  "/teaMyCourses",
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
      response.render("teaMyCourses", {
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

      // Create an array to hold course details including enrollment count
      const coursesWithEnrollment = [];

      // Loop through each course to fetch enrollment count
      for (const course of userCourses) {
        const enrollmentCount = await Enrollments.count({
          where: { courseId: course.id },
          distinct: true,
          col: "userId",
        });

        coursesWithEnrollment.push({
          id: course.id,
          courseName: course.courseName,
          enrollmentCount: enrollmentCount,
        });
      }

      // Sort courses based on enrollment count in descending order for knowing popularity
      const sortedCourses = coursesWithEnrollment.sort(
        (a, b) => b.enrollmentCount - a.enrollmentCount,
      );

      const allCourses = await Courses.findAll();

      // Loop through each course to fetch enrollment count
      const allCoursesWithEnrollment = [];
      for (const course of allCourses) {
        const enrollmentCount = await Enrollments.count({
          where: { courseId: course.id },
          distinct: true,
          col: "userId",
        });

        const userId = course.userId;
        const userOfCourse = await Users.findByPk(userId);

        allCoursesWithEnrollment.push({
          id: course.id,
          userFName: userOfCourse.firstName,
          userLName: userOfCourse.lastName,
          courseName: course.courseName,
          enrollmentCount: enrollmentCount,
        });
      }

      // Sort all courses based on enrollment count in descending order for popularity
      const sortedAllCourses = allCoursesWithEnrollment.sort(
        (a, b) => b.enrollmentCount - a.enrollmentCount,
      );

      // Render the viewReport page and pass the user's courses with enrollment count
      response.render("viewReport", {
        title: `${currentUser.firstName}'s Courses Report`,
        courses: sortedCourses,
        allCourses: sortedAllCourses,
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
    const existingEnrollments = await Enrollments.findAll();

    // Fetch chapters associated with the course
    const chapters = await Chapters.findAll({ where: { courseId } });

    if (!course) {
      // Handle cases where the course is not found
      return response.status(404).json({ message: "Course not found" });
    }

    // console.log(user)
    // Render the course details template and pass the course details and number of students enrolled to it
    response.render("course-details", {
      title: `${course.courseName} by ${userofCourse.firstName} ${userofCourse.lastName}`,
      course,
      chapters,
      userofCourse,
      enrols: existingEnrollments,
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
    const existingEnrollments = await Enrollments.findAll();

    const currentUserId = request.query.currentUserId;
    const currentUser = await Users.findByPk(decodeURIComponent(currentUserId));

    const pages = await Pages.findAll({ where: { chapterId } });

    response.render("createPage", {
      title: "Pages",
      chapterId,
      chapter,
      pages,
      course,
      userOfCourse,
      enrols: existingEnrollments,
      currentUser,
      csrfToken: request.csrfToken(),
    });
  },
);

//route for onlyy enrolled students
app.get(
  "/view-chapter/:id/viewpage",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const chapterId = request.params.id;
    const chapter = await Chapters.findByPk(chapterId);
    const courseId = chapter.courseId;
    const course = await Courses.findByPk(courseId);
    const userOfCourseId = course.userId;
    const userOfCourse = await Users.findByPk(userOfCourseId);
    const existingEnrollments = await Enrollments.findAll();

    const currentUserId = request.query.currentUserId;
    const currentUser = await Users.findByPk(decodeURIComponent(currentUserId));
    const currentPageIndex = request.query.currentPageIndex || 0; // Get currentPageIndex from the query parameter or set it to 0 by default

    const pages = await Pages.findAll({ where: { chapterId } });

    response.render("enrolledStuViewPage", {
      title: "Pages",
      chapterId,
      chapter,
      pages,
      course,
      userOfCourse,
      enrols: existingEnrollments,
      currentUser,
      currentPageIndex,
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
        title: `Student ${currentUser.firstName} Dashboard`,
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
    });

    response.redirect("/student-dashboard");
  },
);

//route to display enrolled courses by the student
app.get(
  "/stuMyCourses",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const currentUser = request.user;

    try {
      // Fetch the courses that the current user is enrolled in
      const enrolledCourses = await Enrollments.findAll({
        where: { userId: currentUser.id },
      });

      const coursesWithPageInfo = [];

      for (const enrollment of enrolledCourses) {
        // Fetch the course associated with the enrollment
        const course = await Courses.findByPk(enrollment.courseId, {
          include: [
            {
              model: Chapters,
              include: [Pages],
            },
          ],
        });

        // Check if the course is retrieved
        if (course) {
          // Check if the course is already in the array
          const existingCourse = coursesWithPageInfo.find(
            (c) => c.courseId === course.id,
          );

          if (!existingCourse) {
            // Calculate the total number of pages for the course
            const totalPages = course.Chapters.reduce(
              (total, chapter) => total + chapter.Pages.length,
              0,
            );

            // Fetch the count of completed pages for the user in this course
            const donePagesCount = await Enrollments.count({
              where: {
                courseId: course.id,
                userId: currentUser.id,
                completed: true,
              },
            });

            coursesWithPageInfo.push({
              userId: course.userId,
              courseId: course.id,
              courseName: course.courseName,
              donePagesCount: donePagesCount,
              totalPages: totalPages,
            });
          }
        }
      }

      console.log(coursesWithPageInfo);

      const existingUsers = await Users.findAll();

      // Render the stuMyCourses page and pass the enrolled courses to it
      response.render("stuMyCourses", {
        title: `${currentUser.firstName}'s Enrolled Courses`,
        courses: coursesWithPageInfo,
        users: existingUsers,
        currentUser,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(422).json(error);
    }
  },
);

//mark page as complete
app.post("/mark-as-complete", async (request, response) => {
  try {
    const userId = request.body.userId;
    const courseId = request.body.courseId;
    const chapterId = request.body.chapterId;
    var pageId = parseInt(request.body.pageId) + 1;

    console.log(userId);
    console.log(courseId);
    console.log(chapterId);
    console.log(pageId);
    await Enrollments.create({
      userId,
      courseId,
      chapterId,
      pageId,
      completed: true,
    });

    if (pageId === 1) {
      response.redirect(
        `/view-chapter/${chapterId}/viewpage?currentUserId=${userId}`,
      );
    } else {
      response.redirect(
        `/view-chapter/${chapterId}/viewpage?currentUserId=${userId}&currentPageIndex=${
          pageId - 1
        }`,
      );
    }
  } catch (error) {
    console.error("Error marking page as complete", error);
    response
      .status(500)
      .send("An error occurred while marking the page as complete");
  }
});

// DELETE a course
app.delete(
  "/courses/:id",
  connnectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const courseId = request.params.id;

    console.log("We have to delete a course with ID: ", courseId);

    try {
      // Find all chapters associated with the course
      const chapters = await Chapters.findAll({ where: { courseId } });

      // Delete all pages associated with the chapters
      for (const chapter of chapters) {
        await Pages.destroy({ where: { chapterId: chapter.id } });
      }

      // Delete all chapters associated with the course
      await Chapters.destroy({ where: { courseId } });

      // Delete the course
      const status = await Courses.remove(courseId);

      return response.json(status ? true : false);
    } catch (err) {
      console.error(err);
      return response.status(422).json(err);
    }
  },
);

//change password routes
app.get("/changePassword", (request, reponse) => {
  const currentUser = request.user;

  reponse.render("changePassword", {
    title: "Change Password",
    currentUser,
    csrfToken: request.csrfToken(),
  });
});

app.post("/changePassword", async (request, response) => {
  const userEmail = request.body.email;
  const newPassword = request.body.password;

  try {
    // Find the user by email
    const user = await Users.findOne({ where: { email: userEmail } });

    if (!user) {
      request.flash("error", "User with that email does not exist.");
      return response.redirect("/resetpassword");
    }

    // Hash the new password
    const hashedPwd = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password in the database
    await user.update({ password: hashedPwd });

    // Redirect to a success page or login page
    if (user.role === "teacher") {
      return response.redirect("/teacher-dashboard");
    } else if (user.role === "student") {
      return response.redirect("/student-dashboard");
    }
  } catch (error) {
    console.log(error);
    request.flash("error", "Error updating the password.");
    return response.redirect("/changePassword");
  }
});

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
