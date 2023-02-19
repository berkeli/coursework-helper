import { Request, Response } from "express";
import Github from "../github/";

export default async (req: Request, res: Response) => {
  const repo = req.query.repo as string;
  const issue = req.query.issue as string;
  const token = req.headers.authorization as string;
  const allowDuplicates = (req.query.allowDuplicates as string) === "true";

  if (!repo && !issue) {
    res.status(400).json({ error: "You must provide repo or issue to clone from" });
    return;
  }

  try {
    const gh = new Github(token.split(" ")[1]);

    if (!issue && repo) {
      // Clone all issues from repo
      await gh.cloneAllFromRepo(repo, allowDuplicates);
    }

    if (issue && repo) {
      // Clone issue
    }

    res.json({ repo });
  } catch (error) {
    res.status(500).json(error);
    return;
  }
};
