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

const updateUser = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;
  const { name, email } = req.body;
  const user = await UserService.updateUser(userId, name, email);

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
});

const deleteUser = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;
  await UserService.deleteUser(userId);

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

const fetchUserbyId = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;
  const user = await UserService.getUserById(userId);

  res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: user,
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
  updateUser,
  deleteUser,
  fetchUserbyId,
  getAllUsers,
};