"use client";

import type {
  INoticeListResponse,
  INoticeResponse,
  INoticeTagsResponse,
  NoticeSortBy,
  NoticeSortOrder,
  NoticeTag,
} from "@/lib/interfaces";

interface ICreateNoticePayload {
  title: string;
  content: string;
  forAll?: boolean;
  forTeachers?: boolean;
  targetBatchId?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  tag?: NoticeTag;
}

interface IFetchNoticesOptions {
  sortBy?: NoticeSortBy;
  sortOrder?: NoticeSortOrder;
  tag?: NoticeTag | "all";
}

export async function fetchNotices(
  page: number = 1,
  limit: number = 10,
  options: IFetchNoticesOptions = {},
): Promise<INoticeListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (options.sortBy) {
    params.set("sortBy", options.sortBy);
  }

  if (options.sortOrder) {
    params.set("sortOrder", options.sortOrder);
  }

  if (options.tag && options.tag !== "all") {
    params.set("tag", options.tag);
  }

  const res = await fetch(`/api/v1/notice?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch notices");

  return res.json();
}

export async function createNotice(data: ICreateNoticePayload): Promise<INoticeResponse> {
  const res = await fetch(`/api/v1/notice`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function fetchPendingNotices(): Promise<INoticeListResponse> {
  const res = await fetch(`/api/v1/notice/pending`, {
    credentials: "include",
  });

  return res.json();
}

export async function fetchNoticeTags(): Promise<INoticeTagsResponse> {
  const res = await fetch(`/api/v1/notice/tags`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch notice tags");
  }

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

export async function fetchNoticeById(id: number): Promise<INoticeResponse> {
  const res = await fetch(`/api/v1/notice/${id}`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch notice");

  return res.json();
}

export function getAttachmentDownloadUrl(attachmentId: number): string {
  return `/api/v1/attachment/download/${attachmentId}`;
}
