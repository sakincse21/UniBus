import { Response } from "express";

export const setCookie = (
  res: Response,
  token: string
) => {
  res.cookie("token", token, {
    maxAge: 1000 * 60 * 60 * 24 * 7, // Expires in 7 days
    httpOnly: true, // Accessible only by the server
    secure: true, // Sent only over HTTPS
    sameSite: "none",
  });
};


export const deleteCookie = (res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
};