import { Request, Response, NextFunction } from "express";

// verify there's a valid github token in the request
export default (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  next();
};
