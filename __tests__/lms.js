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

  test("should sign up a new user", async () => {
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

  test("should sign in a user", async () => {
    await login(agent, "john.doe@example.com", "password123");
  });

  test("should view courses created by a teacher", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teaMyCoursesRes = await agent.get("/teaMyCourses");
    expect(teaMyCoursesRes.statusCode).toBe(200);
  });

  test("should view enrolled courses for a student", async () => {
    await login(agent, "student@example.com", "password123");

    const stuMyCoursesRes = await agent.get("/stuMyCourses");
    expect(stuMyCoursesRes.statusCode).toBe(200);
  });

  test("should view teacher's dashboard", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teacherDashboardRes = await agent.get("/teacher-dashboard");
    expect(teacherDashboardRes.statusCode).toBe(200);
  });

  test("should view student's dashboard", async () => {
    await login(agent, "student@example.com", "password123");

    const studentDashboardRes = await agent.get("/student-dashboard");
    expect(studentDashboardRes.statusCode).toBe(200);
  });

  test("should view teacher's report", async () => {
    await login(agent, "teacher@example.com", "password123");

    const teacherReportRes = await agent.get("/view-report");
    expect(teacherReportRes.statusCode).toBe(200);
  });

  test("should create a new course", async () => {
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

  test("should sign out the user", async () => {
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);

    res = await agent.get("/teacher-dashboard");
    expect(res.statusCode).toBe(302);

    res = await agent.get("/student-dashboard");
    expect(res.statusCode).toBe(302);
  });
});
