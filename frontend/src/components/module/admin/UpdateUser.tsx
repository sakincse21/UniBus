/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateUser } from "@/lib/action/user";
import { IUser } from "@/lib/interfaces";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

export const updateUserSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required"),
  email: z.email({ error: "Email is required" }).min(1, "Email is required"),
//   password: z
//     .string({ error: "Password is required" })
//     .min(6, "Password must be at least 6 characters long"),
});

const UpdateUserForm = ({user}:{user: IUser|null}) => {
  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user?.name,
      email: user?.email
    },
  });
  const router = useRouter()

  async function onSubmit(values: z.infer<typeof updateUserSchema>) {
    console.log(values);
    const toastId = toast.loading("Updating user...");
    try {
      const res = await updateUser(values, user!.user_id);
      if (res.success) {
        toast.success("User updated successfully!", { id: toastId });
        // form.reset();
        router.refresh();
      } else {
        toast.error(`Failed to update user: ${res.message}`, { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
    }
  }

  return (
    <div className="w-full h-full max-w-md mt-8 flex flex-col gap-4 justify-center items-center">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-98">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-4">
                <FormLabel className="w-64">
                  Name <span className=" align-super text-red-500">*</span>
                </FormLabel>
                <div className="w-full flex flex-col">
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-4">
                <FormLabel className="w-64">
                  Email <span className=" align-super text-red-500">*</span>
                </FormLabel>
                <div className="w-full flex flex-col">
                  <FormControl>
                    <Input type="email" placeholder="Enter email" {...field} />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />


          <div className="flex justify-center mt-4 gap-4">
            <Button variant={"secondary"} type="button" onClick={() => router.back()}>
                Cancel
            </Button>
            <Button
              type="submit"
              variant={"default"}
              className="bg-green-500 hover:bg-green-700 px-12 py-4"
            >
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default UpdateUserForm;
