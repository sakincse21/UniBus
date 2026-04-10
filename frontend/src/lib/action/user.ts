"use server"
import { addUserSchema } from "@/components/module/admin/AddUser";
import { cookies } from "next/headers";
import z from "zod";
import { configs } from "../config.env";
import { revalidateTag } from "next/cache";
import { updateUserSchema } from "@/components/module/admin/UpdateUser";

const API = configs.BACKEND_BASE_URL + "/api/v1";

export const fetchUser = async (user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const data = await fetch(`${API}/user/${user_id}`, {
    cache: "no-store",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    next: {
      tags: ['user']
    }
  }).then((res) => res.json());

  const user = data?.data;

  return user;
};

export const fetchAllUsers = async (options: Record<string, string>) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const queryParams = new URLSearchParams(options).toString();
  const data = await fetch(`${API}/user/?${queryParams}`, {
    cache: "no-store",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    next: {
      tags: ['users']
    }
  }).then((res) => res.json());

  const users = data?.data;
  const meta = data?.meta;

  return { users, meta };
};

export const addUser = async (values: z.infer<typeof addUserSchema>) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const response = await fetch(`${API}/user/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify({ ...values }),
    credentials: "include"
  });


  const data = await response.json();

  return data;
};

export const addBulkUsers = async (formData: FormData) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");

  const response = await fetch(`${API}/user/bulk-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: formData,
    credentials: "include",
  });


  const data = await response.json();

  return data;
};


export const updateUser = async (values: z.infer<typeof updateUserSchema>, user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const response = await fetch(`${API}/user/${user_id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify({ ...values }),
    credentials: "include"
  });
  const data = await response.json();

  return data;
};

export const deleteUser = async (user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const response = await fetch(
    `${API}/user/${user_id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie?.value}`,
      },
      credentials: "include",
    }
  );
  const data = await response.json();

  return data;
};

export const fetchMyProfile = async () => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const response = await fetch(`${API}/user/me`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    credentials: "include",
  });

  const data = await response.json();
  return data;
};

export const updateMyProfile = async (values: { name?: string; email?: string; password?: string }) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  const response = await fetch(`${API}/user/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify(values),
    credentials: "include",
  });
  const data = await response.json();
  return data;
};
