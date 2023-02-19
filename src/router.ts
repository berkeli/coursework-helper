import { Router } from "express";
import c from "./controllers/";
import auth from "./middleware/auth";

const router = Router();

router.post("/auth", c.auth);
router.post("/clone", auth, c.clone);

export default router;
