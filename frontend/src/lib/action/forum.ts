"use client";

import {
  IForumCommentsResponse,
  IForumPostResponse,
  IForumPostsResponse,
} from "@/lib/interfaces";

export async function fetchForumPosts(
  search: string,
  page: number = 1,
  limit: number = 20,
): Promise<IForumPostsResponse> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  });

  const res = await fetch(`/api/v1/forum/posts?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch forum posts");
  }

  return res.json() as Promise<IForumPostsResponse>;
}

export async function createForumPost(data: { title: string; content: string }) {
  const res = await fetch("/api/v1/forum/posts", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function fetchForumPostById(postId: number): Promise<IForumPostResponse> {
  const res = await fetch(`/api/v1/forum/posts/${postId}`, {
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Failed to fetch forum post";

    try {
      const payload = (await res.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Keep fallback message when response body is not JSON.
    }

    throw new Error(message);
  }

  return res.json() as Promise<IForumPostResponse>;
}

export async function fetchForumComments(postId: number): Promise<IForumCommentsResponse> {
  const res = await fetch(`/api/v1/forum/posts/${postId}/comments`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch forum comments");
  }

  return res.json() as Promise<IForumCommentsResponse>;
}

export async function createForumComment(postId: number, data: { content: string }) {
  const res = await fetch(`/api/v1/forum/posts/${postId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
}
