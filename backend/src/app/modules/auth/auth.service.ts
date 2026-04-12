import { AppDataSource } from "../../db/data-source";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { AppError } from "../../errors/AppError";
import { env } from "../../config/env";
import userRepo from "../user/user.repository";
import { sendForgotPasswordEmail } from "../../utils/emailService";

const generateTempPassword = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const register = async (name: string, email: string, password: string) => {
  const exists = await userRepo.findOne({ where: { email } });
  if (exists) throw new AppError("User already exists", 409);

  const hashed = await bcrypt.hash(password, env.BCRYPT_SALT);

  const user = userRepo.create({ name, email, password: hashed });
  await userRepo.save(user);

  return { id: user.user_id, email: user.email };
};

const login = async (email: string, password: string) => {
  // need to select password explicitly as it's excluded by default
  const user = await userRepo.findOne({
    where: { email },
    select: ["user_id", "email", "password", "role"],
  });
  if (!user) throw new AppError("Invalid credentials", 401);

  console.log(user);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError("Invalid credentials", 401);

  console.log(user.user_id, user.email, user.role);
  const token = jwt.sign(
    { userId: user.user_id, email: user.email, role: user.role },
    env.JWT_SECRET as string,
    { expiresIn: env.JWT_EXPIRES } as SignOptions,
  );

  return { id: user.user_id, email: user.email, role: user.role, token };
};

const forgotPassword = async (email: string) => {
  const user = await userRepo.findOne({ where: { email } });
  if (!user) throw new AppError("User not found", 404);

  // Generate temporary password
  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, env.BCRYPT_SALT);

  // Update user password
  user.password = hashedPassword;
  await userRepo.save(user);

  // Send email
  await sendForgotPasswordEmail(email, tempPassword, user.name);

  return { success: true, message: "Password reset link sent to your email" };
};

export const AuthService = {
  register,
  login,
  forgotPassword,
};
