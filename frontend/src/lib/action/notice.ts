"use client";

export async function fetchNotices() {
  const res = await fetch(`/api/v1/notice`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch notices");

  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotice(data: any) {
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
  const res = await fetch(`/api/v1/notice/${id}/approve`, {
    method: "PUT",
    credentials: "include",
  });
  return res.json();
}

export async function rejectNotice(id: number) {
  const res = await fetch(`/api/v1/notice/${id}/reject`, {
    method: "PUT",
    credentials: "include",
  });
  return res.json();
}

export async function deleteNotice(id: number) {
  const res = await fetch(`/api/v1/notice/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

export async function uploadAttachments(noticeId: number, files: File[]) {
  const formData = new FormData();
  formData.append("noticeId", noticeId.toString());
  
  files.forEach((file) => {
    formData.append("attachments", file);
  });

  const res = await fetch(`/api/v1/attachment/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return res.json();
}

export async function getAttachmentsByNotice(noticeId: number) {
  const res = await fetch(`/api/v1/attachment/notice/${noticeId}`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch attachments");

  return res.json();
}

export async function deleteAttachment(attachmentId: number) {
  const res = await fetch(`/api/v1/attachment/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return res.json();
}

export async function fetchNoticeById(id: number) {
  const res = await fetch(`/api/v1/notice/${id}`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch notice");

  return res.json();
}

export function getAttachmentDownloadUrl(attachmentId: number): string {
  return `/api/v1/attachment/download/${attachmentId}`;
}
