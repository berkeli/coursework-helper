import app from "express";
import config from "./config";
import router from "./router";
import cors from "cors";

const server = app();

server.use(
  cors({
    origin: config.clientUrl,
  })
);
server.use("/", router);

server.listen(config.port, async () => {
  console.log("Server is running on port " + config.port);
});

module.exports = server;
