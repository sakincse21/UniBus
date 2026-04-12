"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAllUsers } from "@/lib/action/user";
import { fetchBuses } from "@/lib/action/bus";
import { fetchRoutes } from "@/lib/action/route";
import { fetchPendingNotices } from "@/lib/action/notice";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    buses: 0,
    routes: 0,
    pendingNotices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAllUsers({ page: "1", limit: "1" }),
      fetchBuses(),
      fetchRoutes(),
      fetchPendingNotices().catch(() => ({ data: [] })),
    ]).then(([usersRes, busesRes, routesRes, pendingRes]) => {
      setStats({
        users: usersRes?.meta?.totalItems || usersRes?.users?.length || 0,
        buses: busesRes?.data?.length || 0,
        routes: routesRes?.data?.length || 0,
        pendingNotices: pendingRes?.data?.length || 0,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    {
      title: "Total Users",
      value: stats.users,
      description: "Registered students",
    },
    {
      title: "Buses",
      value: stats.buses,
      description: "Active buses",
    },
    {
      title: "Routes",
      value: stats.routes,
      description: "Defined routes",
    },
    {
      title: "Pending Notices",
      value: stats.pendingNotices,
      description: "Awaiting approval",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your system
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}