/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import {parse} from "cookie";
import { cookies } from "next/headers";
import { configs } from "../config.env";

export async function loginAction(_currentState:any, formData: FormData): Promise<any> {
    try {
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const res = await fetch(`${configs.BACKEND_BASE_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        console.log(res)

        if (!res.ok) {
          return { message: "Login failed" };
        }


        const setCookieHeaders = res.headers.getSetCookie();

        const  cookieStore = await cookies();

        if(setCookieHeaders && setCookieHeaders.length > 0) {
          const cookiesArr = setCookieHeaders.map(cookieStr => parse(cookieStr));
          const tokenCookie = cookiesArr.find(cookie => cookie.token);
          if (!tokenCookie || !tokenCookie.token) {
            throw new Error("Token not found");
          }

          // FIX: Only use secure cookies in production
          const isProduction = process.env.NODE_ENV === "production";

          cookieStore.set('token', tokenCookie.token,{
            httpOnly: true, // Always true for security
            secure: isProduction, // False for localhost/HTTP, True for Production/HTTPS
            path: tokenCookie.path || '/',
            maxAge: 60 * 60 * 24 * 7,
            sameSite: "lax",
          })
        }
        

        return res.json();
    } catch (error) {
        console.log(error)
        return { message: "An error occurred during login" };
    }
}


export const logoutFunc = async () => {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("token");
    return true;
  } catch (error) {
    console.error("Error during logout:", error);
  }
}

export const forgotPasswordAction = async (email: string): Promise<any> => {
  try {
    const res = await fetch(`${configs.BACKEND_BASE_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { 
        success: false,
        message: data.message || "Failed to send reset email"
      };
    }

    return { 
      success: true,
      message: data.message || "Password reset email sent successfully"
    };
  } catch (error) {
    console.error("Error during forgot password:", error);
    return { 
      success: false,
      message: "An error occurred. Please try again."
    };
  }
}