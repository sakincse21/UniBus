/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { addBulkUsers } from "@/lib/action/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

export const addBulkUserSchema = z.object({
  file: z
    .instanceof(File, { message: "Excel file is required" })
    .refine(
      (file) =>
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel",
      "Only .xlsx or .xls files are allowed"
    )
    .refine((file) => file.size <= 10 * 1024 * 1024, "Max size is 10MB"),
});

const AddBulkUsersForm = () => {
  const form = useForm<z.infer<typeof addBulkUserSchema>>({
    resolver: zodResolver(addBulkUserSchema),
  });

  async function onSubmit(values: z.infer<typeof addBulkUserSchema>) {
    console.log(values);
    const toastId = toast.loading("Creating user...");

    const formData = new FormData();
    formData.append("file", values.file);

    try {
      const res = await addBulkUsers(formData);
      if (res.success) {
        toast.success("Users created successfully!", { id: toastId });
        form.reset();
      } else {
        toast.error(`Failed to create users: ${res.message}`, { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
    }
  }

  return (
    <div className="w-full h-full max-w-md mt-8 flex flex-col gap-4 justify-center items-center">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center gap-4">
                <div className="w-full flex flex-col">
                  <FormControl>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                    />
                  </FormControl>
                  <FormDescription className="py-2">
                    Upload an Excel file containing user details. Use this given
                    template.
                  </FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

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

export default AddBulkUsersForm;
