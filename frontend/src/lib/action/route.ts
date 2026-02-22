"use server";
import { cookies } from "next/headers";

const API_BASE = process.env.BACKEND_BASE_URL || "http://192.168.10.108:5000";

const getAuthHeaders = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token?.value}`,
  };
};

export const fetchRoutes = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const fetchRouteById = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/${id}`, {
    cache: "no-store",
    headers,
  });
  return res.json();
};

export const createRoute = async (name: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  return res.json();
};

export const updateRoute = async (id: number, name: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name }),
  });
  return res.json();
};

export const deleteRoute = async (id: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/${id}`, {
    method: "DELETE",
    headers,
  });
  return res.json();
};

export const setRoutePoints = async (
  routeId: number,
  points: { lat: number; lng: number; sequence: number; minuteOffset: number }[]
) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/${routeId}/points`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ points }),
  });
  return res.json();
};

export const addRoutePoint = async (
  routeId: number,
  point: { lat: number; lng: number; sequence: number; minuteOffset: number }
) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/${routeId}/points`, {
    method: "POST",
    headers,
    body: JSON.stringify(point),
  });
  return res.json();
};

export const updateRoutePoint = async (
  pointId: number,
  data: { lat?: number; lng?: number; sequence?: number; minuteOffset?: number }
) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/points/${pointId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteRoutePoint = async (pointId: number) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/route/points/${pointId}`, {
    method: "DELETE",
    headers,
  });
  return res.json();
};
