"use server";
import { cookies } from "next/headers";

const API_BASE = process.env.BACKEND_BASE_URL || "http://localhost:5000";

const getAuthHeaders = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token?.value}`,
  };
};

export const fetchSchedules = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/schedule`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const fetchScheduleById = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/schedule/${id}`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const createSchedule = async (data: {
  busId: number;
  routeId: number;
  startTime: string;
  endTime: string;
}) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/schedule`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateSchedule = async (
  id: number,
  data: { routeId?: number; startTime?: string; endTime?: string }
) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/schedule/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteSchedule = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/schedule/${id}`, {
    method: "DELETE",
    headers,
  });
  return res.json();
};
