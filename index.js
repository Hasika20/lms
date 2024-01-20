/* eslint-disable no-undef */
const app = require("./app");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is listening at port ${port}`);
});
