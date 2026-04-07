"use client";

import { ICalendarEvent, ICreateFixturePayload, IUpdateFixturePayload, IUserFixture } from "../interfaces";

export async function fetchCalendarEvents(days: number = 30): Promise<{
  success: boolean;
  data: ICalendarEvent[];
}> {
  const res = await fetch(`/api/v1/calendar/events?days=${days}`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch calendar events");

  return res.json();
}

export async function createPersonalFixture(
  data: ICreateFixturePayload,
): Promise<{
  success: boolean;
  data: IUserFixture;
}> {
  const res = await fetch(`/api/v1/calendar/fixtures`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to create fixture");

  return res.json();
}

export async function fetchPersonalFixtures(): Promise<{
  success: boolean;
  data: IUserFixture[];
}> {
  const res = await fetch(`/api/v1/calendar/fixtures`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch fixtures");

  return res.json();
}

export async function updatePersonalFixture(
  id: number,
  data: IUpdateFixturePayload,
): Promise<{
  success: boolean;
  data: IUserFixture;
}> {
  const res = await fetch(`/api/v1/calendar/fixtures/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to update fixture");

  return res.json();
}

export async function deletePersonalFixture(id: number): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`/api/v1/calendar/fixtures/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to delete fixture");

  return res.json();
}

export async function deleteNotice(id: number): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`/api/v1/calendar/notice/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to delete notice");

  return res.json();
}
