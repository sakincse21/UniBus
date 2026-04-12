/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import {
  fetchRoutes,
  createRoute,
  deleteRoute,
} from "@/lib/action/route";
import Link from "next/link";

const ITEMS_PER_PAGE = 10;

export default function RoutesManagementPage() {
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [routeName, setRouteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadRoutes = async () => {
    const res = await fetchRoutes();
    if (res.success) setAllRoutes(res.data);
  };

  useEffect(() => {
    let ignore = false;
    fetchRoutes().then((res) => {
      if (!ignore && res.success) setAllRoutes(res.data);
    });
    return () => { ignore = true; };
  }, []);

  const totalPages = Math.ceil(allRoutes.length / ITEMS_PER_PAGE);
  const paginatedRoutes = allRoutes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreate = async () => {
    if (!routeName.trim()) return toast.error("Route name is required");
    setLoading(true);
    const res = await createRoute(routeName.trim());
    setLoading(false);
    if (res.success) {
      toast.success("Route created");
      setRouteName("");
      loadRoutes();
      setCurrentPage(1);
    } else {
      toast.error(res.message || "Failed to create route");
    }
  };

  const handleDelete = async (id: number) => {
    const res = await deleteRoute(id);
    if (res.success) {
      toast.success("Route deleted");
      loadRoutes();
    } else {
      toast.error(res.message || "Failed to delete route");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Route</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Route Name (e.g. Campus to Station)"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Adding..." : "Add Route"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Routes</CardTitle>
        </CardHeader>
        <CardContent>
          {allRoutes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No routes added yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Route Name</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>{route.id}</TableCell>
                      <TableCell className="font-medium">{route.name}</TableCell>
                      <TableCell>{route.points?.length || 0} points</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/dashboard/routes/${route.id}`}>
                          <Button variant="secondary" size="sm">
                            Edit Points
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Route?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete route &quot;{route.name}&quot;
                                and all its points. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(route.id)}
                                className="bg-destructive"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination className="mt-6">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
