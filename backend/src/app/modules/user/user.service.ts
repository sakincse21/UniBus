import { env } from "../../config/env";
import { AppDataSource } from "../../db/data-source";
import { AppError } from "../../errors/AppError";
import { User, UserRole } from "./user.entity";
import userRepo from "./user.repository";
import bcrypt from "bcryptjs";

const createUser = async (payload: Partial<User>) => {
  const { name, email, password, batch } = payload;
  const exists = await userRepo.findOne({ where: { email } });
  if (exists) {
    throw new AppError("User already exists", 409);
  }
  const ifBatchExists = await AppDataSource.getRepository("Batch").findOne({ where: { name: batch } });
  if (!ifBatchExists) {
    throw new AppError("Batch does not exist", 404);
  }
  console.log(ifBatchExists)
  const hashed = bcrypt.hashSync(password as string, env.BCRYPT_SALT);
  const user = userRepo.create({ name, email, password: hashed, batch: ifBatchExists.id });
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
      role: UserRole.STUDENT,
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
