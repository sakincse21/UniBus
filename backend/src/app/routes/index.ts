import { Router } from "express";
import { AuthRouter } from "../modules/auth/auth.route";
import { UserRouter } from "../modules/user/user.route";

const router = Router();

router.use('/auth', AuthRouter);
router.use('/user', UserRouter);

export default router;
