import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authValidate } from "../../middlewares/authValidate";

const router = Router();


router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);
router.get("/socket-token", authValidate, AuthController.getSocketToken);


export const AuthRouter = router;