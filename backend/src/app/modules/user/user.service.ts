import { env } from "../../config/env";
import { AppDataSource } from "../../db/data-source";
import { AppError } from "../../errors/AppError";
import { User, UserRole } from "./user.entity";
import userRepo from "./user.repository";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

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
  const hashed = bcrypt.hashSync(password as string, env.BCRYPT_SALT);
  const user = userRepo.create({ name, email, password: hashed, batch: ifBatchExists.id });
  await userRepo.save(user);
  return user;
};

const bulkCreateUsers = async (filePath: string) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  if (!rows.length) {
    throw new AppError("The uploaded file contains no data", 400);
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const { name, email, password, batch } = row;

    if (!name || !email || !password) {
      results.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
      results.skipped++;
      continue;
    }

    try {
      const exists = await userRepo.findOne({ where: { email } });
      if (exists) {
        results.errors.push(`User with email ${email} already exists`);
        results.skipped++;
        continue;
      }

      let batchEntity = null;
      if (batch) {
        batchEntity = await AppDataSource.getRepository("Batch").findOne({ where: { name: String(batch) } });
        if (!batchEntity) {
          results.errors.push(`Batch "${batch}" not found for user ${email}`);
          results.skipped++;
          continue;
        }
      }

      const hashed = bcrypt.hashSync(String(password), env.BCRYPT_SALT);
      const user = userRepo.create({
        name: String(name),
        email: String(email),
        password: hashed,
        batch: batchEntity ? batchEntity.id : undefined,
      });
      await userRepo.save(user);
      results.created++;
    } catch (err: any) {
      results.errors.push(`Failed to create user ${email}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
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
  const user = await userRepo.findOne({
    where: { user_id: userId },
    relations: ["batch"],
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
};

const getMyProfile = async (userId: string) => {
  const user = await userRepo.findOne({
    where: { user_id: userId },
    relations: ["batch"],
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
};

const updateMyProfile = async (userId: string, name?: string, email?: string) => {
  const user = await userRepo.findOne({ where: { user_id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (name) user.name = name;
  if (email) {
    const emailExists = await userRepo.findOne({ where: { email } });
    if (emailExists && emailExists.user_id !== userId) {
      throw new AppError("Email already in use", 409);
    }
    user.email = email;
  }
  await userRepo.save(user);
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
  bulkCreateUsers,
  updateUser,
  deleteUser,
  getUserById,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
};
