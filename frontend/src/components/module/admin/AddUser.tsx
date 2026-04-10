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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addUser } from "@/lib/action/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

export const addUserSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required"),
  email: z.email({ error: "Email is required" }).min(1, "Email is required"),
  password: z
    .string({ error: "Password is required" })
    .min(6, "Password must be at least 6 characters long"),
  role: z.enum(["student", "teacher", "cr"], { error: "Role is required" }),
  batchNumber: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || val === "" || !isNaN(Number(val)),
      "Batch number must be a valid number"
    ),
}).refine(
  (data) => data.role !== "student" || (data.batchNumber && data.batchNumber !== ""),
  {
    message: "Batch number is required for students",
    path: ["batchNumber"],
  }
);

const AddUserForm = () => {
  const form = useForm<z.infer<typeof addUserSchema>>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "student",
      batchNumber: "",
    },
  });

  const role = form.watch("role");

  async function onSubmit(values: z.infer<typeof addUserSchema>) {
    console.log(values);
    const toastId = toast.loading("Creating user...");
    try {
      const submitData = {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        ...(values.role === "student" && { batchNumber: Number(values.batchNumber) }),
      };
      const res = await addUser(submitData as any);
      if (res.success) {
        toast.success("User created successfully!", { id: toastId });
        form.reset();
      } else {
        toast.error(`Failed to create user: ${res.message}`, { id: toastId });
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-4">
                <FormLabel className="w-64">
                  Password <span className=" align-super text-red-500">*</span>
                </FormLabel>
                <div className="w-full flex flex-col">
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-4">
                <FormLabel className="w-64">
                  Role <span className=" align-super text-red-500">*</span>
                </FormLabel>
                <div className="w-full flex flex-col">
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="cr">Class Representative (CR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {role === "student" && (
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-4">
                  <FormLabel className="w-64">
                    Batch Number{" "}
                    <span className=" align-super text-red-500">*</span>
                  </FormLabel>
                  <div className="w-full flex flex-col">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter batch number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          )}

          <div className="flex justify-center mt-4">
            <Button
              type="submit"
              variant={"default"}
              className="bg-green-500 hover:bg-green-700 px-12 py-4"
            >
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddUserForm;
