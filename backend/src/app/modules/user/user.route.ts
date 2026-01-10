import { Router } from "express";
import { UserController } from "./user.controller";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";

const router = Router();

router.post("/", authValidate, roleValidate(['admin']), UserController.createUser);
router.patch("/:id", authValidate, UserController.updateUser);
router.delete("/:id", authValidate, UserController.deleteUser);
router.get("/:id", authValidate, UserController.fetchUserbyId);
router.get("/", authValidate, roleValidate(['admin']), UserController.getAllUsers);

export const UserRouter = router;