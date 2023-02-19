import config from "./config";
import { App } from "octokit";

const github = new App({
  appId: config.githubAppId,
  privateKey: config.githubAppPrivateKey,
});

export default github;
