"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchPendingNotices } from "@/lib/action/notice";
import Link from "next/link";
import { useRole } from "@/components/RoleProvider";

export default function HomePage() {
  const role = useRole();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Fetch pending count for CR/admin
    if (role === "cr" || role === "admin") {
      fetchPendingNotices()
        .then((res) => setPendingCount(res?.data?.length || 0))
        .catch(() => {});
    }
  }, [role]);

  const quickLinks = [
    {
      title: "Bus Schedule",
      description: "View live bus schedules and routes",
      url: "/buses",
      accent: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    },
    {
      title: "Notices",
      description: "Read announcements and updates",
      url: "/notice",
      accent: "from-violet-500/10 to-violet-600/5 border-violet-500/20",
    },
    ...(role === "student" || role === "cr" || role === "admin"
      ? [
          {
            title: "Create Notice",
            description:
              role === "student"
                ? "Submit a notice for approval"
                : "Publish a notice to your batch",
            url: "/notice/create",
            accent: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
          },
        ]
      : []),
    {
      title: "Profile",
      description: "View and update your profile",
      url: "/profile",
      accent: "from-orange-500/10 to-orange-600/5 border-orange-500/20",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to UniBus
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role && (
            <>
              Logged in as{" "}
              <span className="capitalize font-medium text-foreground">
                {role}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Pending notices alert for CR/admin */}
      {(role === "cr" || role === "admin") && pendingCount > 0 && (
        <Link href="/notice/pending">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 cursor-pointer hover:bg-amber-500/10 transition-colors">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <span className="font-medium">
                {pendingCount} notice{pendingCount !== 1 ? "s" : ""} pending
                review
              </span>{" "}
              — Click to review and approve.
            </p>
          </div>
        </Link>
      )}

      {/* Quick links grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.url} href={link.url}>
            <Card
              className={`h-full bg-gradient-to-br ${link.accent} hover:shadow-md transition-all duration-200 cursor-pointer`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{link.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{link.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Admin shortcut */}
      {role === "admin" && (
        <div>
          <h2 className="text-lg font-medium mb-3">Administration</h2>
          <Link href="/dashboard">
            <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20 hover:shadow-md transition-all duration-200 cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Admin Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage buses, routes, schedules, and users
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}