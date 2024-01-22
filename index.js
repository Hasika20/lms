/* eslint-disable no-undef */
const port = process.env.PORT || 3000; //just to make sure app opens fast

const app = require("./app");

app.listen(port, () => {
  console.log(`Started express server at port ${port}`);
});
