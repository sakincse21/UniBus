import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";
import tryCatch from "../../utils/tryCatch";

const createUser = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body;
  const user = await UserService.createUser(payload);

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user,
  });
});

const bulkUploadUsers = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded. Please upload an xlsx file.",
    });
  }

  const results = await UserService.bulkCreateUsers(req.file.path);

  res.status(200).json({
    success: true,
    message: `Created ${results.created} users, skipped ${results.skipped}`,
    data: results,
  });
});

const updateUser = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id as string;
  const payload = req.body;
  const user = await UserService.updateUser(userId, payload);

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
});

const deleteUser = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id as string;
  await UserService.deleteUser(userId);

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

const fetchUserbyId = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id as string;
  const user = await UserService.getUserById(userId);

  res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: user,
  });
});

const getMyProfile = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user.userId;
  console.log("user requested, ", userId)
  const user = await UserService.getMyProfile(userId);

  res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: user,
  });
});

const updateMyProfile = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user.userId;
  const { name, email, password } = req.body;
  const user = await UserService.updateMyProfile(userId, name, email, password);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});

const updateMyPushToken = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const { pushToken } = req.body as { pushToken?: string | null };

  if (pushToken !== undefined && pushToken !== null && typeof pushToken !== "string") {
    return res.status(400).json({
      success: false,
      message: "pushToken must be a string or null",
    });
  }

  const data = await UserService.updateMyPushToken(
    userId,
    typeof pushToken === "string" ? pushToken : null,
  );

  res.status(200).json({
    success: true,
    message: "Push token updated successfully",
    data,
  });
});

const getAllUsers = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const users = await UserService.getAllUsers();

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: users,
  });
});

export const UserController = {
  createUser,
  bulkUploadUsers,
  updateUser,
  deleteUser,
  fetchUserbyId,
  getMyProfile,
  updateMyProfile,
  updateMyPushToken,
  getAllUsers,
};