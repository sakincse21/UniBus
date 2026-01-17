"use server"
import { addUserSchema } from "@/components/module/admin/AddUser";
import { cookies } from "next/headers";
import z from "zod";
import { configs } from "../config.env";
import { revalidateTag } from "next/cache";
import { updateUserSchema } from "@/components/module/admin/UpdateUser";

export const fetchUser = async (user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  console.log(sessionCookie)
  const data = await fetch(`/api/v1/user/${user_id}`, {
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
  console.log(sessionCookie)
  const queryParams = new URLSearchParams(options).toString();
  console.log(queryParams);
  const data = await fetch(`/api/v1/user/?${queryParams}`, {
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

  return {users, meta};
};

export const addUser = async (values: z.infer<typeof addUserSchema>) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  console.log(sessionCookie?.value);
  const response = await fetch(`/api/v1/user/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify({ ...values }),
    credentials: "include"
  });

  revalidateTag("users", "max");

  const data = await response.json();

  return data;
};

export const addBulkUsers = async (formData: FormData) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  
  const file = formData.get("file");
  console.log("File received in server action:", file);

  const response = await fetch(`/api/v1/user/bulk-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: formData,
    credentials: "include",
  });

  revalidateTag("users", "max");
//   console.log(response)

  const data = await response.json();

  return data;
};


export const updateUser = async (values: z.infer<typeof updateUserSchema>, user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  console.log(sessionCookie?.value);
  const response = await fetch(`/api/v1/user/${user_id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
    body: JSON.stringify({ ...values }),
    credentials: "include"
  });

  revalidateTag("users", "max");
  revalidateTag("user", "max");

  // console.log(response)
  const data = await response.json();

  return data;
};

export const deleteUser = async (user_id: string) => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("token");
  console.log(sessionCookie?.value);
  const response = await fetch(
    `/api/v1/user/${user_id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie?.value}`,
      },
      credentials: "include",
    }
  );

  revalidateTag("users", "max");
  revalidateTag("user", "max");

  const data = await response.json();

  return data;
};
