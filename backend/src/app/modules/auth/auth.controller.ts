import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import tryCatch from "../../utils/tryCatch";
import { setCookie } from "../../utils/authCookies";

const register = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = req.body;
  const user = await AuthService.register(name, email, password);

  res.status(201).json({
    success: true,
    message: "User registered",
    data: user,
  });
});

const login = tryCatch(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  console.log(req.body);
  console.log('login korbe ekhon: ', email)
  const data = await AuthService.login(email, password);

  setCookie(res, data.token);

  res.json({
    success: true,
    message: "Login successful",
    data,
  });
});

const forgotPassword = tryCatch(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const result = await AuthService.forgotPassword(email);

  res.json({
    success: true,
    message: result.message,
  });
});

const getSocketToken = (req: Request, res: Response) => {
  res.json({
    token: req.cookies.token,
  });
};


export const AuthController = {
  register,
  login,
  forgotPassword,
  getSocketToken,
};
