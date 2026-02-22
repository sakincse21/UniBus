// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";
// import jwt from "jsonwebtoken";
// import { configs } from "./lib/config.env";

// // export const runtime = "nodejs"; // Use Node.js runtime for jsonwebtoken

// // export enum UserRole {
// //   ADMIN = "admin",
// //   TEACHER = "teacher",
// //   STUDENT = "student",
// //   CR = "cr",
// // }

// type UserRole = "admin" | "teacher" | "student" | "cr";

// type RouteConfig = {
//   exact: string[];
//   patterns: RegExp[];
// };

// const authRoutes = ["/login", "/register"];

// const userProtectedRoutes: RouteConfig = {
//   exact: ["/profile", "/buses"],
//   patterns: [/^\/bus(\/.*)?$/],
// };

// const crProtectedRoutes: RouteConfig = {
//   exact: ["/profile", "/buses"],
//   patterns: [/^\/bus(\/.*)?$/],
// };

// const teacherProtectedRoutes: RouteConfig = {
//   exact: ["/profile", "/buses"],
//   patterns: [/^\/bus(\/.*)?$/],
// };

// const adminProtectedRoutes: RouteConfig = {
//   exact: ["/profile"],
//   // patterns: [/^\/dashboard(\/.*)?$/],
//   patterns: [/^\/dashboard(\/.*)?$/],
// };

// const isAuthRoute = (pathname: string): boolean => {
//   return authRoutes.some((route) => route === pathname);
// };

// const isRouteMatches = (
//   pathname: string,
//   routesObject: RouteConfig
// ): boolean => {
//   if (routesObject.exact.includes(pathname)) {
//     return true;
//   }

//   return routesObject.patterns.some((pattern) => pattern.test(pathname));
// };

// const getRouteOwner = (
//   pathname: string
// ): "auth" | "admin" | "student" | "cr" | "teacher" | "public" => {
//   if (isAuthRoute(pathname)) {
//     return "auth";
//   }

//   if (isRouteMatches(pathname, adminProtectedRoutes)) {
//     return "admin";
//   }

//   if (isRouteMatches(pathname, userProtectedRoutes)) {
//     return "student"; // For simplicity, treating all user-protected routes as student routes
//   }

//   if (isRouteMatches(pathname, crProtectedRoutes)) {
//     return "cr";
//   }

//   if (isRouteMatches(pathname, teacherProtectedRoutes)) {
//     return "teacher";
//   }

//   return "public";
// };

// const getDefaultDashboard = (role: UserRole): string => {
//   switch (role) {
//     case "admin":
//       return "/dashboard";
//     case "student":
//       return "/buses";
//     case "teacher":
//       return "/buses";
//     case "cr":
//       return "/buses";
//     default:
//       return "/";
//   }
// };

// // This function can be marked `async` if using `await` inside
// export function proxy(request: NextRequest) {
//   const pathName = request.nextUrl.pathname;
//   const token = request.cookies.get("token")?.value || null;

//   let userRole: UserRole | null = null;

//   console.log("Token from cookie:", token);

//   if (token) {
//     try {
//       const secret = configs.JWT_SECRET;

//       if (!secret) {
//         console.error("JWT_SECRET is not defined in environment variables");
//         throw new Error("Configuration error");
//       }

//       const verifiedToken = jwt.verify(token, secret as string);
//       console.log(verifiedToken, 'token verifies')
//       if (typeof verifiedToken === "string") {
//         throw new Error("Invalid token payload");
//       }
//       userRole = verifiedToken.role as UserRole;
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     } catch (error) {
//       // Token is invalid or expired, redirect to login and clear cookie
//       const response = NextResponse.redirect(new URL("/login", request.url));
//       response.cookies.delete("token");
//       return response;
//     }
//   }

//   const routeOwner = getRouteOwner(pathName);
//   console.log(routeOwner)

//   if (!token) {
//     if( routeOwner === "public" || routeOwner === "auth") {
//       return NextResponse.next();
//     }
//     return NextResponse.redirect(new URL("/login", request.url));
//   }
//   // Redirect logged-in users from auth pages (login/register)
//   if (token && userRole && routeOwner === "auth") {
//     return NextResponse.redirect(
//       new URL(getDefaultDashboard(userRole), request.url)
//     );
//   }

//   if (token && userRole !== routeOwner) {
//     return NextResponse.redirect(
//       new URL(getDefaultDashboard(userRole as UserRole), request.url)
//     );
//   }

//   return NextResponse.next();
// }
// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      */
//     "/((?!api|_next/static|_next/image|favicon.ico).*)",
//   ],
// };

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { configs } from "./lib/config.env";
import next from "next";

type UserRole = "admin" | "teacher" | "student" | "cr";

type RouteConfig = {
  exact: string[];
  patterns: RegExp[];
};

// Public routes that don't require authentication
const publicRoutes: RouteConfig = {
  exact: ["/", "/about", "/contact"], // Add your public routes here
  patterns: [],
};

const authRoutes = ["/login", "/register"];

// Role-specific protected routes
const adminProtectedRoutes: RouteConfig = {
  exact: ["/profile"],
  patterns: [/^\/dashboard(\/.*)?$/, /^\/notice(\/.*)?$/],
};

const studentProtectedRoutes: RouteConfig = {
  exact: ["/profile"],
  patterns: [/^\/buses(\/.*)?$/, /^\/bus(\/.*)?$/, /^\/notice(\/.*)?$/],
};

const crProtectedRoutes: RouteConfig = {
  exact: ["/profile"],
  patterns: [/^\/buses(\/.*)?$/, /^\/bus(\/.*)?$/, /^\/notice(\/.*)?$/],
};

const teacherProtectedRoutes: RouteConfig = {
  exact: ["/profile"],
  patterns: [/^\/buses(\/.*)?$/, /^\/bus(\/.*)?$/, /^\/notice(\/.*)?$/],
};

const isPublicRoute = (pathname: string): boolean => {
  if (publicRoutes.exact.includes(pathname)) return true;
  return publicRoutes.patterns.some((pattern) => pattern.test(pathname));
};

const isAuthRoute = (pathname: string): boolean => {
  return authRoutes.includes(pathname);
};

const isRouteMatches = (
  pathname: string,
  routesObject: RouteConfig,
): boolean => {
  if (routesObject.exact.includes(pathname)) {
    return true;
  }
  return routesObject.patterns.some((pattern) => pattern.test(pathname));
};

const getRequiredRole = (
  pathname: string,
): UserRole | "auth" | "public" | null => {
  // Check public routes first
  if (isPublicRoute(pathname)) {
    return "public";
  }

  // Check auth routes
  if (isAuthRoute(pathname)) {
    return "auth";
  }

  // Check role-specific routes
  if (isRouteMatches(pathname, adminProtectedRoutes)) {
    return "admin";
  }

  if (isRouteMatches(pathname, studentProtectedRoutes)) {
    return "student";
  }

  if (isRouteMatches(pathname, crProtectedRoutes)) {
    return "cr";
  }

  if (isRouteMatches(pathname, teacherProtectedRoutes)) {
    return "teacher";
  }

  // Default to requiring authentication for all other routes
  // This prevents unauthenticated access to unknown routes
  return "public"; // or return null to block all unauthenticated access
};

const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "student":
      return "/buses";
    case "teacher":
      return "/notice";
    case "cr":
      return "/buses";
    default:
      return "/";
  }
};

export function proxy(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const token = request.cookies.get("token")?.value;

  console.log("Path:", pathName);
  console.log("Has token:", !!token);

  // Get the required role/access level for this route
  const requiredAccess = getRequiredRole(pathName);
  console.log("Required access:", requiredAccess);

  // Allow access to public routes for everyone
  if (requiredAccess === "public") {
    return NextResponse.next();
  }

  // Handle unauthenticated users
  if (!token) {
    // Allow access to auth routes (login/register)
    if (requiredAccess === "auth") {
      return NextResponse.next();
    }

    // Redirect all other routes to login
    const loginUrl = new URL("/login", request.url);
    // Add the original URL as a redirect parameter
    loginUrl.searchParams.set("redirect", pathName);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token for authenticated users
  try {
    const secret = configs.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not defined");
      // Clear invalid cookie and redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }

    const verifiedToken = jwt.verify(token, secret);

    if (typeof verifiedToken === "string") {
      throw new Error("Invalid token payload");
    }

    console.log(verifiedToken)

    const userRole = verifiedToken.role as UserRole;
    console.log("User role:", userRole);

    // Allow access to auth routes? Usually you want to redirect authenticated users away from login/register
    if (requiredAccess === "auth") {
      // Redirect authenticated users away from login/register to their dashboard
      return NextResponse.redirect(
        new URL(getDefaultDashboard(userRole), request.url),
      );
    }

    // Check if user has required role
    if (requiredAccess && requiredAccess !== userRole) {
      // User doesn't have permission, redirect to their dashboard
      if(pathName === "/notice" || /^\/notice(\/.*)?$/.test(pathName)) {
        return NextResponse.next();
      }
      return NextResponse.redirect(
        new URL(getDefaultDashboard(userRole), request.url),
      );
    }

    // User has permission, allow access
    return NextResponse.next();
  } catch (error) {
    // Token is invalid or expired
    console.error("Token verification failed:", error);

    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token");
    return response;
  }
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
