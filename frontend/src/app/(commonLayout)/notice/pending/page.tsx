/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
  fetchPendingNotices,
  approveNotice,
  rejectNotice,
} from "@/lib/action/notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { formatBangladesh } from "@/lib/dateTime";

export default function PendingNoticePage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingNotices().then((res) => {
      setNotices(res.data || []);
      setLoading(false);
    });
  }, []);

  const approve = async (id: number) => {
    await approveNotice(id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notice approved");
  };

  const reject = async (id: number) => {
    await rejectNotice(id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notice rejected");
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Pending Notices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve student notices
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
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
      ) : notices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No pending notices to review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium">
                    {n.title}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {formatBangladesh(n.createdAt, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {n.createdBy && (
                  <p className="text-xs text-muted-foreground">
                    By {n.createdBy.name || "Unknown"}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-4">{n.content}</p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reject(n.id)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => approve(n.id)}>
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
