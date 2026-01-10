import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { User } from "./user.entity";
import userRepo from "./user.repository";
import bcrypt from "bcryptjs";

const createUser = async (payload: Partial<User>) => {
  const { name, email, password } = payload;
  const exists = await userRepo.findOne({ where: { email } });
  if (exists) {
    throw new AppError("User already exists", 409);
  }
  const hashed = bcrypt.hashSync(password as string, env.BCRYPT_SALT);
  const user = userRepo.create({ name, email, password: hashed });
  await userRepo.save(user);
  return user;
};

const updateUser = async (userId: string, name: string, email: string) => {
  const user = await userRepo.findOne({ where: { user_id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (name) user.name = name;
  if (email) user.email = email;
  await userRepo.save(user);
  return user;
};

const deleteUser = async (userId: string) => {
  const user = await userRepo.findOne({ where: { user_id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  await userRepo.remove(user);
};

const getUserById = async (userId: string) => {
  const user = await userRepo.findOne({ where: { user_id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
};

const getAllUsers = async () => {
  const users = await userRepo.find({
    where: {
      role: "user",
    }
  });
  return users;
};

export const UserService = {
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  getAllUsers,
};
