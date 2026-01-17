import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { configs } from "./lib/config.env";

// export const runtime = "nodejs"; // Use Node.js runtime for jsonwebtoken

type UserRole = "admin" | "user";

type RouteConfig = {
  exact: string[];
  patterns: RegExp[];
};

const authRoutes = ["/login", "/register"];

const userProtectedRoutes: RouteConfig = {
  exact: ["/profile", "/buses"],
  patterns: [/^\/bus(\/.*)?$/],
};

const adminProtectedRoutes: RouteConfig = {
  exact: ["/profile"],
  // patterns: [/^\/dashboard(\/.*)?$/],
  patterns: [/^\/dashboard(\/.*)?$/],
};

const isAuthRoute = (pathname: string): boolean => {
  return authRoutes.some((route) => route === pathname);
};

const isRouteMatches = (
  pathname: string,
  routesObject: RouteConfig
): boolean => {
  if (routesObject.exact.includes(pathname)) {
    return true;
  }

  return routesObject.patterns.some((pattern) => pattern.test(pathname));
};

const getRouteOwner = (
  pathname: string
): "auth" | "admin" | "user" | "public" => {
  if (isAuthRoute(pathname)) {
    return "auth";
  }

  if (isRouteMatches(pathname, adminProtectedRoutes)) {
    return "admin";
  }

  if (isRouteMatches(pathname, userProtectedRoutes)) {
    return "user";
  }

  return "public";
};

const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "user":
      return "/buses";
    default:
      return "/";
  }
};

export function proxy(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const token = request.cookies.get("token")?.value || null;

  let userRole: UserRole | null = null;

  console.log("Token from cookie:", token);

  if (token) {
    try {
      const secret = configs.JWT_SECRET;
      
      if (!secret) {
        console.error("JWT_SECRET is not defined in environment variables");
        throw new Error("Configuration error");
      }

      const verifiedToken = jwt.verify(token, secret as string);
      console.log(verifiedToken, 'token verifies')
      if (typeof verifiedToken === "string") {
        throw new Error("Invalid token payload");
      }
      userRole = verifiedToken.role as UserRole;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Token is invalid or expired, redirect to login and clear cookie
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  const routeOwner = getRouteOwner(pathName);
  console.log(routeOwner)

  if (!token) {
    if( routeOwner === "public" || routeOwner === "auth") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Redirect logged-in users from auth pages (login/register)
  if (token && userRole && routeOwner === "auth") {
    return NextResponse.redirect(
      new URL(getDefaultDashboard(userRole), request.url)
    );
  }

  if (token && userRole !== routeOwner) {
    return NextResponse.redirect(
      new URL(getDefaultDashboard(userRole as UserRole), request.url)
    );
  }

  return NextResponse.next();
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
