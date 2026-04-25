"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IUser } from "@/lib/interfaces";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteUser, fetchAllUsers } from "@/lib/action/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const fetchUsers = async (options: Record<string, string>) => {
  try {
    const data = await fetchAllUsers(options);
    return data;
  } catch (error) {
    console.error("Error fetching users:", error);
  }
};

const orderOptions = ["Asc", "Desc"];
const sortOptions = ["Name", "Email"];
const limitOptions = [10, 20, 50];

export default function AllUsers() {
  const [search, setSearch] = useState<string | null>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string | null>(""); // Add this
  const [order, setOrder] = useState<string>(orderOptions[0].toLowerCase());
  const [sort, setSort] = useState<string>(sortOptions[0].toLowerCase());
  const [limit, setLimit] = useState<string>(limitOptions[0].toString());
  const [deletedUserId, setDeletedUserId] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState(1);

  const router = useRouter();
  const [users, setUsers] = useState<IUser[]>([]);
  const [meta, setMeta] = useState<any>(null);

  //debounce search without submit button
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 1500);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    const options = {
      page: currentPage.toString(),
      limit: limit.toString(),
      sort: sort.toLowerCase(),
      order: order.toLowerCase(),
      search: debouncedSearch || "",
    };
    fetchUsers(options).then((data: any) => {
      if (data) {
        setUsers(data?.users || []);
        setMeta(data?.meta || null);
        if(data?.users?.length === 0 && currentPage > 1){
          setCurrentPage(1);
        }
      }
    });
  }, [currentPage, sort, order, limit, debouncedSearch, deletedUserId]);

  //   console.log(users.length);
  const totalPage = meta?.totalPages || 1;

  const handleDeleteUser = async (userId: string) => {
    const toastId = toast.loading("Deleting user...");
    try {
      const res = await deleteUser(userId);
      if (res.success) {
        toast.success("User deleted successfully!", { id: toastId });
        setDeletedUserId(true)
        router.refresh();
      } else {
        toast.error(`Failed to delete user: ${res.message}`, { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  console.log(users)

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="w-full flex flex-row justify-between items-center gap-2">
            <div className="w-5/12">
              <Input
                placeholder="Search users..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-6/12 flex flex-row justify-end gap-2 items-center">
              <Select onValueChange={(value) => setSort(value)} value={sort}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions?.map((option) => (
                    <SelectItem key={option} value={option.toLocaleLowerCase()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setOrder(value)} value={order}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem disabled value="null">
                    Select
                  </SelectItem>
                  {orderOptions?.map((option) => (
                    <SelectItem key={option} value={option.toLocaleLowerCase()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => setLimit(value)}
                value={limit.toString()}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  {limitOptions?.map((option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {users?.length > 0 ? (
            <div className="mt-8">
              <Table className="[&_td]:border-border [&_th]:border-border border-separate border-spacing-0 [&_tfoot_td]:border-t [&_th]:border-b [&_tr]:border-none [&_tr:not(:last-child)_td]:border-b h-full">
                <TableHeader className="bg-background/90 sticky top-0 backdrop-blur-xs">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-y-auto">
                  {users?.map((user: IUser) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium text-start">{user.name}</TableCell>
                      <TableCell className="font-medium text-start">{user.email}</TableCell>
                      <TableCell className="font-medium text-start capitalize">{user.role || "N/A"}</TableCell>
                      <TableCell className="font-medium text-start">
                        {user.batch?.name || "N/A"}
                      </TableCell>
                      <TableCell className="text-right flex flex-row gap-2 justify-end">

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Are you absolutely sure?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will
                                permanently delete your account and remove your
                                data from our servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="bg-destructive"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Link href={`/dashboard/manage-users/${user.user_id}`}>
                          <Button variant={"secondary"}>Update</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPage > 1 && (
                <div className="flex justify-end mt-4">
                  <div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((prev) => prev - 1)}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: totalPage },
                          (_, index) => index + 1
                        ).map((page) => (
                          <PaginationItem
                            key={page}
                            onClick={() => setCurrentPage(page)}
                          >
                            <PaginationLink isActive={currentPage === page}>
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            className={
                              currentPage === totalPage
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex justify-center">
              <span className="font-semibold text-lg mt-8">
                No Users found. Try changing filters.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
