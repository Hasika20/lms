/* eslint-disable no-undef */
const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  const $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/logging").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("LMS test suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(3000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Prevent access for unauthorized users", async () => {
    // Send a GET request to the dashboard route without authentication
    let response = await request(app).get("/teacher-dashboard");
    expect(response.status).toBe(302);

    response = await request(app).get("/teacher-dashboard");
    expect(response.status).toBe(302);
  });

  test("Sign up a new user", async () => {
    const res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);

    const newUser = {
      firstName: "Test",
      lastName: "User",
      email: "testuser@example.com",
      password: "password123",
      role: "student",
      _csrf: csrfToken,
    };

    const signupRes = await agent.post("/users").send(newUser);
    expect(signupRes.statusCode).toBe(302);
  });

  test("Sign in a user", async () => {
    await login(agent, "john.doe@example.com", "password123");
  });

  test("View courses created by a teacher", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teaMyCoursesRes = await agent.get("/teaMyCourses");
    expect(teaMyCoursesRes.statusCode).toBe(200);
  });

  test("View enrolled courses for a student", async () => {
    await login(agent, "student@example.com", "password123");

    const stuMyCoursesRes = await agent.get("/stuMyCourses");
    expect(stuMyCoursesRes.statusCode).toBe(200);
  });

  test("View teacher's dashboard", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teacherDashboardRes = await agent.get("/teacher-dashboard");
    expect(teacherDashboardRes.statusCode).toBe(200);
  });

  test("View student's dashboard", async () => {
    await login(agent, "student@example.com", "password123");

    const studentDashboardRes = await agent.get("/student-dashboard");
    expect(studentDashboardRes.statusCode).toBe(200);
  });

  test("View teacher's report", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teacherReportRes = await agent.get("/view-report");
    expect(teacherReportRes.statusCode).toBe(200);
  });

  test("Create a new course", async () => {
    await login(agent, "teacher@example.com", "password123");

    const csrfToken = extractCsrfToken(await agent.get("/createcourse"));
    const newCourse = {
      courseName: "New Course",
      courseDescription: "Description for the new course.",
      _csrf: csrfToken,
    };

    const createCourseRes = await agent.post("/createcourse").send(newCourse);
    expect(createCourseRes.statusCode).toBe(302);
  });

  test("Create a new chapter", async () => {
    await login(agent, "teacher@example.com", "password123");

    let csrfToken = extractCsrfToken(await agent.get("/createcourse"));

    //create test course
    const createdCourse = {
      courseName: "Test Course",
      courseDescription: "Description for the new course.",
      _csrf: csrfToken,
    };

    await agent.post("/createcourse").send(createdCourse);

    //create test chapter
    csrfToken = extractCsrfToken(
      await agent.get(`/view-course/${1}/createchapter?currentUserId=${1}`),
    );
    const newChapter = {
      chapterName: "Test Chapter",
      chapterDescription: "Description for the new chapter.",
      _csrf: csrfToken,
    };

    // Send a request to create a chapter for the created course
    const createChapterRes = await agent
      .post(`/view-course/${createdCourse.id}/createchapter`)
      .send(newChapter);

    expect(createChapterRes.statusCode).toBe(302);
  });

  test("Change Password", async () => {
    await login(agent, "student@example.com", "password123");

    const csrfToken = extractCsrfToken(await agent.get("/changePassword"));

    const newPassword = "newPass123";

    const changePasswordResponse = await agent.post("/changePassword").send({
      userEmail: "student@example.com",
      newPassword: newPassword,
      _csrf: csrfToken,
    });

    expect(changePasswordResponse.statusCode).toBe(302);
    await login(agent, "student@example.com", newPassword);

    const loginResponse = await agent.get("/student-dashboard");
    expect(loginResponse.statusCode).toBe(200);
  });

  test("Sign out the user", async () => {
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);

    res = await agent.get("/teacher-dashboard");
    expect(res.statusCode).toBe(302);

    res = await agent.get("/student-dashboard");
    expect(res.statusCode).toBe(302);
  });
});
