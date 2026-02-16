/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { fetchNotices } from "@/lib/action/notice";
import { getSocket } from "@/lib/socket";

export default function NoticePage() {
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    fetchNotices().then((res) => {
      setNotices(res.data);
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
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Notices</h1>

      {notices?.map((n) => (
        <div key={n.id} className="border p-4 rounded">
          <h2 className="font-semibold">{n.title}</h2>
          <p className="text-sm text-gray-500">
            {new Date(n.createdAt).toLocaleString()}
          </p>
          <p className="mt-2">{n.content}</p>
        </div>
      ))}
    </div>
  );
}
