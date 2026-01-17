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

const getSocketToken = (req: Request, res: Response) => {
  res.json({
    token: req.cookies.token,
  });
};


export const AuthController={
    register,
    login,
    getSocketToken,
}
