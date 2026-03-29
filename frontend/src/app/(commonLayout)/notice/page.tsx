/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { fetchNotices } from "@/lib/action/notice";
import { getSocket } from "@/lib/socket";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NoticePage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotices().then((res) => {
      setNotices(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let socket: any;

    (async () => {
      socket = await getSocket();

      socket.on("notice_published", (notice: any) => {
        setNotices((prev) => [notice, ...prev]);
      });
    })();

    return () => {
      if (socket) socket.off("notice_published");
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Announcements and updates
          </p>
        </div>
        <Link href="/notice/create">
          <Button>New Notice</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notices?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No notices available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices?.map((n) => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium">
                    {n.title}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {new Date(n.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {n.createdBy && (
                  <p className="text-xs text-muted-foreground">
                    By {n.createdBy.name || "Unknown"}
                    {n.createdBy.role && (
                      <span className="ml-1 capitalize">
                        ({n.createdBy.role})
                      </span>
                    )}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{n.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
