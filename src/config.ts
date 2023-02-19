import * as dotenv from "dotenv";

dotenv.config();

const config = {
  port: process.env.PORT || "3000",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
  githubAppId: process.env.APP_ID || "",
  githubAppPrivateKey: process.env.PRIVATE_KEY || "",
  defaultRepo: process.env.DEFAULT_REPO || "My-Coursework-Planner",
  defaultOwner: process.env.DEFAULT_OWNER || "CodeYourFuture",
};

if (!config.clientId) {
  throw new Error("CLIENT_ID is not defined");
}

if (!config.clientSecret) {
  throw new Error("CLIENT_SECRET is not defined");
}

if (!config.githubAppId) {
  throw new Error("APP_ID is not defined");
}

if (!config.githubAppPrivateKey) {
  throw new Error("PRIVATE_KEY is not defined");
}

export default config;
