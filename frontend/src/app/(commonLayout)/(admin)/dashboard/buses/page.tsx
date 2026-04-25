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
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { fetchBuses, createBus, updateBus, deleteBus } from "@/lib/action/bus";

const ITEMS_PER_PAGE = 10;

export default function BusManagementPage() {
  const [allBuses, setAllBuses] = useState<any[]>([]);
  const [busNumber, setBusNumber] = useState("");
  const [editBus, setEditBus] = useState<any>(null);
  const [editBusNumber, setEditBusNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadBuses = async () => {
    const res = await fetchBuses();
    if (res.success) setAllBuses(res.data);
  };

  useEffect(() => {
    let ignore = false;
    fetchBuses().then((res) => {
      if (!ignore && res.success) setAllBuses(res.data);
    });
    return () => { ignore = true; };
  }, []);

  const totalPages = Math.ceil(allBuses.length / ITEMS_PER_PAGE);
  const paginatedBuses = allBuses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreate = async () => {
    if (!busNumber.trim()) return toast.error("Bus number is required");
    setLoading(true);
    const res = await createBus(busNumber.trim());
    setLoading(false);
    if (res.success) {
      toast.success("Bus created");
      setBusNumber("");
      loadBuses();
      setCurrentPage(1);
    } else {
      toast.error(res.message || "Failed to create bus");
    }
  };

  const handleUpdate = async () => {
    if (!editBusNumber.trim()) return toast.error("Bus number is required");
    setLoading(true);
    const res = await updateBus(editBus.id, editBusNumber.trim());
    setLoading(false);
    if (res.success) {
      toast.success("Bus updated");
      setEditBus(null);
      loadBuses();
    } else {
      toast.error(res.message || "Failed to update bus");
    }
  };

  const handleDelete = async (id: number) => {
    const res = await deleteBus(id);
    if (res.success) {
      toast.success("Bus deleted");
      loadBuses();
    } else {
      toast.error(res.message || "Failed to delete bus");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Bus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Bus Number (e.g. BUS-001)"
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Adding..." : "Add Bus"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Buses</CardTitle>
        </CardHeader>
        <CardContent>
          {allBuses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No buses added yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Bus Number</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBuses.map((bus) => (
                    <TableRow key={bus.id}>
                      <TableCell>{bus.id}</TableCell>
                      <TableCell className="font-medium">
                        {bus.busNumber}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditBus(bus);
                            setEditBusNumber(bus.busNumber);
                          }}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Bus?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete bus {bus.busNumber}.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(bus.id)}
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


      <Dialog open={!!editBus} onOpenChange={(open) => !open && setEditBus(null)}>
        <DialogContent>
          <DialogTitle>Edit Bus</DialogTitle>
          <div className="space-y-4 mt-4">
            <Input
              value={editBusNumber}
              onChange={(e) => setEditBusNumber(e.target.value)}
              placeholder="Bus Number"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditBus(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
