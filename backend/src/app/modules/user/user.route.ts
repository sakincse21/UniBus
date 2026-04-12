import { Router } from "express";
import { UserController } from "./user.controller";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";
import { uploadXlsx } from "../../middlewares/upload";

const router = Router();

// Profile routes (must be before /:id to avoid conflicts)
router.get("/me", authValidate, UserController.getMyProfile);
router.patch("/me", authValidate, UserController.updateMyProfile);

// Bulk upload
router.post("/bulk-upload", authValidate, roleValidate(['admin']), uploadXlsx, UserController.bulkUploadUsers);

// Admin CRUD
router.post("/", authValidate, roleValidate(['admin']), UserController.createUser);
router.get("/", authValidate, roleValidate(['admin']), UserController.getAllUsers);

// User-specific
router.patch("/:id", authValidate, UserController.updateUser);
router.delete("/:id", authValidate, UserController.deleteUser);
router.get("/:id", authValidate, UserController.fetchUserbyId);

export const UserRouter = router;