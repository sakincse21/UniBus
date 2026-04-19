import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";
import { UserRole } from "../user/user.entity";
import { ForumController } from "./forum.controller";

const router = Router();

router.use(authValidate, roleValidate([UserRole.STUDENT, UserRole.CR]));

router.get("/posts", ForumController.getForumPosts);
router.get("/posts/:postId", ForumController.getForumPostById);
router.post("/posts", ForumController.createForumPost);
router.put("/posts/:postId", ForumController.updateForumPost);
router.delete("/posts/:postId", ForumController.deleteForumPost);

router.get("/posts/:postId/comments", ForumController.getForumComments);
router.post("/posts/:postId/comments", ForumController.createForumComment);
router.put("/comments/:commentId", ForumController.updateForumComment);
router.delete("/comments/:commentId", ForumController.deleteForumComment);

export const ForumRouter = router;
