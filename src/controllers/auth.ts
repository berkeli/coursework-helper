import { Request, Response } from "express";
import { createAppAuth } from "@octokit/auth-app";
import config from "../config";

const auth = createAppAuth({
  appId: config.githubAppId,
  privateKey: config.githubAppPrivateKey,
  clientId: config.clientId,
  clientSecret: config.clientSecret,
});

type AuthResponse = {
  token: string;
  tokenType: string;
  expiresAt: string;
};

export const getAccessToken = async (code: string): Promise<AuthResponse | null> => {
  try {
    const userAuthentication = (await auth({ type: "oauth-user", code })) as AuthResponse;

    return {
      token: userAuthentication.token,
      tokenType: userAuthentication.tokenType,
      expiresAt: userAuthentication.expiresAt,
    };
  } catch (error) {
    console.log(error);
    return null;
  }
};

export default (req: Request, res: Response) => {
  const code = req.query.code;

  if (!code) {
    res.status(400).json({ error: "No code provided" });
    return;
  }

  getAccessToken(code as string).then((resp) => res.json(resp));
};
