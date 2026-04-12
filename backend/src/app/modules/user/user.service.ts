import { env } from "../../config/env";
import { AppDataSource } from "../../db/data-source";
import { AppError } from "../../errors/AppError";
import { User, UserRole } from "./user.entity";
import { Batch } from "../batch/batch.entity";
import userRepo from "./user.repository";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const createUser = async (payload: Partial<User>) => {
  const { name, email, password, role, batchNumber } = payload as any;
  
  // Validate required fields
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }
  
  if (!role || !["student", "teacher", "cr"].includes(role)) {
    throw new AppError("Role must be 'student', 'teacher', or 'cr'", 400);
  }
  
  // Check if user already exists
  const exists = await userRepo.findOne({ where: { email } });
  if (exists) {
    throw new AppError("User already exists", 409);
  }
  
  // For students, batchNumber is required
  let batchEntity = null;
  if (role === "student") {
    if (!batchNumber) {
      throw new AppError("Batch number is required for students", 400);
    }
    // Convert batchNumber to string and look up batch
    const batchName = String(batchNumber);
    batchEntity = await AppDataSource.getRepository("Batch").findOne({ 
      where: { name: batchName } 
    });
    if (!batchEntity) {
      throw new AppError(`Batch "${batchNumber}" does not exist`, 404);
    }
  }
  
  const hashed = bcrypt.hashSync(password as string, env.BCRYPT_SALT);
  const user = userRepo.create({ 
    name, 
    email, 
    password: hashed, 
    role: role as UserRole,
    batch: batchEntity || undefined 
  });
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
    const { name, email, password, role, batchNumber } = row;

    // Validate required fields
    if (!name || !email || !password) {
      results.errors.push(`Row missing required fields (name, email, password): ${JSON.stringify(row)}`);
      results.skipped++;
      continue;
    }

    if (!role || !["student", "teacher", "cr"].includes(String(role).toLowerCase())) {
      results.errors.push(`Invalid role for user ${email}: must be 'student', 'teacher', or 'cr'`);
      results.skipped++;
      continue;
    }

    if (String(role).toLowerCase() === "student" && !batchNumber) {
      results.errors.push(`Batch number is required for student ${email}`);
      results.skipped++;
      continue;
    }

    try {
      // Check if user already exists
      const exists = await userRepo.findOne({ where: { email } });
      if (exists) {
        results.errors.push(`User with email ${email} already exists`);
        results.skipped++;
        continue;
      }

      // Handle batch lookup for students
      let batchEntity = null;
      if (String(role).toLowerCase() === "student") {
        const batchName = String(batchNumber);
        batchEntity = await AppDataSource.getRepository("Batch").findOne({ 
          where: { name: batchName } 
        });
        if (!batchEntity) {
          results.errors.push(`Batch "${batchNumber}" not found for user ${email}`);
          results.skipped++;
          continue;
        }
      }

      const hashed = bcrypt.hashSync(String(password), env.BCRYPT_SALT);
      const user = userRepo.create({
        name: String(name),
        email: String(email),
        password: hashed,
        role: String(role).toLowerCase() as UserRole,
        batch: batchEntity || undefined,
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

const updateUser = async (userId: string, payload: Partial<User>) => {
  const { name, email, role, batchNumber } = payload as any;
  
  const user = await userRepo.findOne({ where: { user_id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  
  // Update basic info
  if (name) user.name = name;
  
  // Handle email update with duplication check
  if (email) {
    const emailExists = await userRepo.findOne({ where: { email } });
    if (emailExists && emailExists.user_id !== userId) {
      throw new AppError("Email already in use", 409);
    }
    user.email = email;
  }
  
  // Handle role update
  if (role) {
    if (!["student", "teacher", "cr"].includes(role)) {
      throw new AppError("Role must be 'student', 'teacher', or 'cr'", 400);
    }
    user.role = role as UserRole;
  }
  
  // Handle batch update for students
  if (role === "student" || (role === undefined && user.role === "student")) {
    if (!batchNumber) {
      throw new AppError("Batch number is required for students", 400);
    }
    const batchName = String(batchNumber);
    const batchEntity = await AppDataSource.getRepository("Batch").findOne({ 
      where: { name: batchName } 
    });
    if (!batchEntity) {
      throw new AppError(`Batch "${batchNumber}" does not exist`, 404);
    }
    user.batch = batchEntity as Batch;
  } else if ((role === "teacher" || role === "cr") && user.batch) {
    // Remove batch for non-student roles
    user.batch = undefined;
  }
  
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

const updateMyProfile = async (userId: string, name?: string, email?: string, password?: string) => {
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
  if (password) {
    if (password.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }
    const hashed = bcrypt.hashSync(password, env.BCRYPT_SALT);
    user.password = hashed;
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
