"use server";

import { cookies } from "next/headers";
import { configs } from "../config.env";

// import { env } from "../config.env";
// import { getCookie } from "./auth";

const BASE_URL = `${configs.BACKEND_BASE_URL}/api/v1/batch`;

export async function fetchBatches() {

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("token");
    console.log(BASE_URL)
  const res = await fetch(BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
}

export async function createBatch(data: { name: string }) {
  const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("token");
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to create batch");
  }
  return res.json();
}

export async function deleteBatch(id: number) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete batch");
  }
  return res.json();
}
