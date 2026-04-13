"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchNotices, fetchPendingNotices } from "@/lib/action/notice";
import { getSocket } from "@/lib/socket";
import { useRole } from "@/components/RoleProvider";

type NoticeLike = {
  id: number;
  title?: string;
  content?: string;
};

const NOTICE_POLL_MS = 25000;

function getNoticeId(value: unknown): number | null {
  const id = Number((value as NoticeLike | undefined)?.id);
  return Number.isFinite(id) ? id : null;
}

function supportsBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function showNoticeBrowserNotification(
  notice: NoticeLike,
  type: "published" | "pending",
): void {
  if (!supportsBrowserNotifications()) return;
  if (Notification.permission !== "granted") return;

  const id = getNoticeId(notice);
  if (id === null) return;

  const title =
    type === "published"
      ? `New notice: ${notice.title || "Untitled"}`
      : `Pending notice: ${notice.title || "Untitled"}`;

  const body =
    notice.content?.trim() ||
    (type === "published"
      ? "A new notice was published."
      : "A new notice is awaiting review.");

  const destination = type === "published" ? "/notice" : "/notice/pending";

  const notification = new Notification(title, {
    body,
    tag: `notice-${type}-${id}`,
    requireInteraction: true,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = destination;
    notification.close();
  };
}

export default function NoticeRealtimeBridge() {
  const role = useRole();
  const isReviewer = role === "admin" || role === "teacher" || role === "cr";

  const seenPublishedIds = useRef(new Set<number>());
  const seenPendingIds = useRef(new Set<number>());
  const latestPublishedId = useRef<number | null>(null);
  const latestPendingId = useRef<number | null>(null);
  const initializedPublished = useRef(false);
  const initializedPending = useRef(false);

  const emitPublished = (notice: NoticeLike, notify: boolean) => {
    const id = getNoticeId(notice);
    if (id === null || seenPublishedIds.current.has(id)) return;

    seenPublishedIds.current.add(id);
    latestPublishedId.current = id;

    window.dispatchEvent(new CustomEvent("NOTICE_PUBLISHED", { detail: notice }));

    if (notify) {
      toast.success(`New notice: ${notice.title || "Untitled"}`);
      showNoticeBrowserNotification(notice, "published");
    }
  };

  const emitPending = (notice: NoticeLike, notify: boolean) => {
    if (!isReviewer) return;

    const id = getNoticeId(notice);
    if (id === null || seenPendingIds.current.has(id)) return;

    seenPendingIds.current.add(id);
    latestPendingId.current = id;

    window.dispatchEvent(new CustomEvent("NOTICE_PENDING", { detail: notice }));

    if (notify) {
      toast.info(`New notice awaiting review: ${notice.title || "Untitled"}`);
      showNoticeBrowserNotification(notice, "pending");
    }
  };

  const emitDeleted = (id: number) => {
    if (!Number.isFinite(id)) return;

    seenPublishedIds.current.delete(id);
    seenPendingIds.current.delete(id);

    window.dispatchEvent(new CustomEvent("NOTICE_DELETED", { detail: { id } }));
  };

  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;

    const onPublished = (notice: NoticeLike) => emitPublished(notice, true);
    const onPending = (notice: NoticeLike) => emitPending(notice, true);
    const onDeleted = (payload: { id: number }) => emitDeleted(Number(payload?.id));

    (async () => {
      try {
        socket = await getSocket();
        socket.on("notice_published", onPublished);
        socket.on("notice_pending", onPending);
        socket.on("notice_deleted", onDeleted);
      } catch {
        // Socket can be unavailable in serverless-style deployments.
      }
    })();

    return () => {
      if (!socket) return;
      socket.off("notice_published", onPublished);
      socket.off("notice_pending", onPending);
      socket.off("notice_deleted", onDeleted);
    };
  }, [isReviewer]);

  useEffect(() => {
    let active = true;

    const hydratePublished = async (notify: boolean) => {
      try {
        const res = await fetchNotices(1, 1);
        const notice = res?.data?.[0] as NoticeLike | undefined;
        const id = getNoticeId(notice);
        if (!active || !notice || id === null) return;

        if (!initializedPublished.current) {
          initializedPublished.current = true;
          latestPublishedId.current = id;
          seenPublishedIds.current.add(id);
          return;
        }

        if (id !== latestPublishedId.current) {
          emitPublished(notice, notify);
        }
      } catch {
        // ignore polling failures
      }
    };

    const hydratePending = async (notify: boolean) => {
      if (!isReviewer) return;

      try {
        const res = await fetchPendingNotices();
        const notice = res?.data?.[0] as NoticeLike | undefined;
        const id = getNoticeId(notice);
        if (!active || !notice || id === null) return;

        if (!initializedPending.current) {
          initializedPending.current = true;
          latestPendingId.current = id;
          seenPendingIds.current.add(id);
          return;
        }

        if (id !== latestPendingId.current) {
          emitPending(notice, notify);
        }
      } catch {
        // ignore polling failures
      }
    };

    void hydratePublished(false);
    void hydratePending(false);

    const timer = setInterval(() => {
      void hydratePublished(true);
      void hydratePending(true);
    }, NOTICE_POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isReviewer]);

  return null;
}
