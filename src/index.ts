import app from "express";
import config from "./config";
import router from "./router";

const server = app();

server.use("/", router);

server.listen(config.port, async () => {
  console.log("Server is running on port " + config.port);
});
