import { Request, Response } from "express";
import { AppDataSource } from "../../db/data-source";
import tryCatch from "../../utils/tryCatch";
import { AppError } from "../../errors/AppError";
import { ForumPost } from "./forumPost.entity";
import { ForumComment } from "./forumComment.entity";
import { User, UserRole } from "../user/user.entity";

const FORUM_ALLOWED_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.CR];

function parsePositiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

async function getForumActor(req: Request): Promise<User> {
  const userId = String(req.user.userId || "");

  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const userRepo = AppDataSource.getRepository(User);
  const actor = await userRepo.findOne({
    where: { user_id: userId },
    relations: ["batch"],
  });

  if (!actor) {
    throw new AppError("User not found", 404);
  }

  if (!FORUM_ALLOWED_ROLES.includes(actor.role)) {
    throw new AppError("Forum is only available for students", 403);
  }

  if (!actor.batch?.id) {
    throw new AppError("You must belong to a batch to use the forum", 400);
  }

  return actor;
}

const getForumPosts = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const batchId = actor.batch!.id;

  const searchRaw = typeof req.query.search === "string" ? req.query.search : "";
  const search = searchRaw.trim().toLowerCase();
  const page = parsePositiveInt(req.query.page, 1, 1000);
  const limit = parsePositiveInt(req.query.limit, 20, 50);

  const postRepo = AppDataSource.getRepository(ForumPost);
  const qb = postRepo
    .createQueryBuilder("post")
    .leftJoinAndSelect("post.author", "author")
    .leftJoinAndSelect("post.batch", "batch")
    .loadRelationCountAndMap("post.commentCount", "post.comments")
    .where("batch.id = :batchId", { batchId });

  if (search) {
    qb.andWhere(
      "(LOWER(post.title) LIKE :search OR LOWER(post.content) LIKE :search OR LOWER(author.name) LIKE :search)",
      { search: `%${search}%` },
    );
  }

  qb.orderBy("post.createdAt", "DESC").skip((page - 1) * limit).take(limit);

  const [posts, totalItems] = await qb.getManyAndCount();

  res.json({
    success: true,
    data: posts,
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    },
  });
});

const getForumPostById = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const batchId = actor.batch!.id;
  const postId = Number(req.params.postId);

  if (!Number.isFinite(postId) || postId <= 0) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  const postRepo = AppDataSource.getRepository(ForumPost);
  const post = await postRepo
    .createQueryBuilder("post")
    .leftJoinAndSelect("post.author", "author")
    .leftJoinAndSelect("post.batch", "batch")
    .loadRelationCountAndMap("post.commentCount", "post.comments")
    .where("post.id = :postId", { postId })
    .andWhere("batch.id = :batchId", { batchId })
    .getOne();

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  res.json({ success: true, data: post });
});

const createForumPost = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();

  if (!title) {
    return res.status(400).json({ message: "Post title is required" });
  }

  if (!content) {
    return res.status(400).json({ message: "Post content is required" });
  }

  if (title.length > 180) {
    return res.status(400).json({ message: "Post title must be 180 characters or fewer" });
  }

  if (content.length > 5000) {
    return res.status(400).json({ message: "Post content must be 5000 characters or fewer" });
  }

  const postRepo = AppDataSource.getRepository(ForumPost);
  const newPost = postRepo.create({
    title,
    content,
    author: { user_id: actor.user_id },
    batch: { id: actor.batch!.id },
  });

  await postRepo.save(newPost);

  const created = await postRepo.findOne({
    where: { id: newPost.id },
    relations: ["author", "batch"],
  });

  res.status(201).json({
    success: true,
    data: created ?? newPost,
  });
});

const updateForumPost = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const postId = Number(req.params.postId);
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();

  if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ message: "Invalid post id" });
  
  if (!title || !content) return res.status(400).json({ message: "Title and content required" });

  const postRepo = AppDataSource.getRepository(ForumPost);
  const post = await postRepo.findOne({ where: { id: postId }, relations: ["author", "batch"] });
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (post.author.user_id !== actor.user_id) return res.status(403).json({ message: "You can only edit your own posts" });

  post.title = title;
  post.content = content;
  await postRepo.save(post);

  res.json({ success: true, data: post });
});

const deleteForumPost = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const postId = Number(req.params.postId);

  if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ message: "Invalid post id" });

  const postRepo = AppDataSource.getRepository(ForumPost);
  const post = await postRepo.findOne({ where: { id: postId }, relations: ["author"] });
  
  if (!post) return res.status(404).json({ message: "Post not found" });
  if (post.author.user_id !== actor.user_id) return res.status(403).json({ message: "You can only delete your own posts" });

  await postRepo.remove(post);
  res.json({ success: true, message: "Post deleted" });
});

const getForumComments = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const postId = Number(req.params.postId);

  if (!Number.isFinite(postId)) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  const postRepo = AppDataSource.getRepository(ForumPost);
  const post = await postRepo.findOne({
    where: { id: postId },
    relations: ["batch"],
  });

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.batch.id !== actor.batch!.id) {
    return res.status(403).json({ message: "You can only access posts from your batch forum" });
  }

  const commentRepo = AppDataSource.getRepository(ForumComment);
  const comments = await commentRepo.find({
    where: { post: { id: postId } },
    relations: ["author"],
    order: { createdAt: "ASC" },
  });

  res.json({ success: true, data: comments });
});

const createForumComment = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const postId = Number(req.params.postId);
  const content = String(req.body.content || "").trim();

  if (!Number.isFinite(postId)) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  if (!content) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  if (content.length > 1000) {
    return res.status(400).json({ message: "Comment must be 1000 characters or fewer" });
  }

  const postRepo = AppDataSource.getRepository(ForumPost);
  const post = await postRepo.findOne({
    where: { id: postId },
    relations: ["batch"],
  });

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.batch.id !== actor.batch!.id) {
    return res.status(403).json({ message: "You can only comment on posts from your batch forum" });
  }

  const commentRepo = AppDataSource.getRepository(ForumComment);
  const comment = commentRepo.create({
    content,
    post: { id: postId },
    author: { user_id: actor.user_id },
  });

  await commentRepo.save(comment);

  const created = await commentRepo.findOne({
    where: { id: comment.id },
    relations: ["author"],
  });

  res.status(201).json({
    success: true,
    data: created ?? comment,
  });
});

const updateForumComment = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const commentId = Number(req.params.commentId);
  const content = String(req.body.content || "").trim();

  if (!Number.isFinite(commentId)) return res.status(400).json({ message: "Invalid comment id" });
  if (!content) return res.status(400).json({ message: "Comment content required" });

  const commentRepo = AppDataSource.getRepository(ForumComment);
  const comment = await commentRepo.findOne({ where: { id: commentId }, relations: ["author"] });

  if (!comment) return res.status(404).json({ message: "Comment not found" });
  if (comment.author.user_id !== actor.user_id) return res.status(403).json({ message: "You can only edit your own comment" });

  comment.content = content;
  await commentRepo.save(comment);

  res.json({ success: true, data: comment });
});

const deleteForumComment = tryCatch(async (req: Request, res: Response) => {
  const actor = await getForumActor(req);
  const commentId = Number(req.params.commentId);

  if (!Number.isFinite(commentId)) return res.status(400).json({ message: "Invalid comment id" });

  const commentRepo = AppDataSource.getRepository(ForumComment);
  const comment = await commentRepo.findOne({ where: { id: commentId }, relations: ["author"] });

  if (!comment) return res.status(404).json({ message: "Comment not found" });
  if (comment.author.user_id !== actor.user_id) return res.status(403).json({ message: "You can only delete your own comment" });

  await commentRepo.remove(comment);
  
  res.json({ success: true, message: "Comment deleted" });
});


export const ForumController = {
  getForumPosts,
  getForumPostById,
  createForumPost,
  updateForumPost,
  deleteForumPost,
  getForumComments,
  createForumComment,
  updateForumComment,
  deleteForumComment
};
