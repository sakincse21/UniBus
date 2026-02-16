"use client";

import { configs } from "../config.env";

export async function fetchNotices() {
  const res = await fetch(`/api/v1/notice`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch notices");

  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotice(data: any) {
    console.log(configs.BACKEND_BASE_URL)
  const res = await fetch(`/api/v1/notice`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function fetchPendingNotices() {
  const res = await fetch(`/api/v1/notice/pending`, {
    credentials: "include",
  });

  return res.json();
}

export async function approveNotice(id: number) {
  return fetch(`/api/v1/notice/${id}/approve`, {
    method: "PATCH",
    credentials: "include",
  });
}

export async function rejectNotice(id: number) {
  return fetch(`/api/v1/notice/${id}/reject`, {
    method: "PATCH",
    credentials: "include",
  });
}

export async function deleteNotice(id: number) {
  return fetch(`/api/v1/notice/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
}
