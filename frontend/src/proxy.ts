import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { configs } from "./lib/config.env";

type UserRole = "admin" | "teacher" | "student" | "cr";

const authRoutes = ["/login", "/register"];

const isAuthRoute = (pathname: string): boolean => {
  return authRoutes.includes(pathname);
};

const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "student":
      return "/buses";
    case "teacher":
      return "/buses";
    case "cr":
      return "/buses";
    default:
      return "/";
  }
};

export function proxy(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const token = request.cookies.get("token")?.value;

  // Public routes - accessible without login
  if (pathName === "/about" || pathName === "/contact") {
    return NextResponse.next();
  }

  // No token - allow auth routes, redirect everything else to login
  if (!token) {
    if (isAuthRoute(pathName)) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathName);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  try {
    const secret = configs.JWT_SECRET;
    if (!secret) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }

    const verifiedToken = jwt.verify(token, secret);
    if (typeof verifiedToken === "string") {
      throw new Error("Invalid token payload");
    }

    const userRole = verifiedToken.role as UserRole;

    // Redirect logged-in users away from auth routes
    if (isAuthRoute(pathName)) {
      return NextResponse.redirect(
        new URL(getDefaultDashboard(userRole), request.url),
      );
    }

    // Dashboard routes are admin-only
    if (/^\/dashboard(\/.*)?$/.test(pathName)) {
      if (userRole !== "admin") {
        return NextResponse.redirect(
          new URL(getDefaultDashboard(userRole), request.url),
        );
      }
    }

    // All other routes (/buses, /notice, /profile, etc.) are accessible to any authenticated user
    return NextResponse.next();
  } catch (error) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
