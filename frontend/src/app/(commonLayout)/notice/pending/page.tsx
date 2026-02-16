/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { fetchPendingNotices, approveNotice, rejectNotice } from "@/lib/action/notice";

export default function PendingNoticePage() {
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    fetchPendingNotices().then((res) => {
      setNotices(res.data);
    });
  }, []);

  const approve = async (id: number) => {
    await approveNotice(id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  const reject = async (id: number) => {
    await rejectNotice(id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Pending Notices</h1>

      {notices?.map((n) => (
        <div key={n.id} className="border p-4 rounded">
          <h2 className="font-semibold">{n.title}</h2>
          <p>{n.content}</p>

          <button
            onClick={() => approve(n.id)}
            className="bg-green-600 text-white px-3 py-1 mt-2 rounded"
          >
            Approve
          </button>
          <button
            onClick={() => reject(n.id)}
            className="bg-red-600 text-white px-3 py-1 mt-2 rounded ml-2"
          >
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
