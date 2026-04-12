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

export const fetchBuses = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/bus`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const fetchBusById = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/bus/${id}`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const createBus = async (busNumber: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/bus`, {
    method: "POST",
    headers,
    body: JSON.stringify({ busNumber }),
  });
  return res.json();
};

export const updateBus = async (id: number, busNumber: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/bus/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ busNumber }),
  });
  return res.json();
};

export const deleteBus = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/bus/${id}`, {
    method: "DELETE",
    headers,
  });
  return res.json();
};
