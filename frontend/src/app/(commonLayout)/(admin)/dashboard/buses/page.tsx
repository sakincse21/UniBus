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
import { toast } from "sonner";
import { fetchBuses, createBus, updateBus, deleteBus } from "@/lib/action/bus";

export default function BusManagementPage() {
  const [buses, setBuses] = useState<any[]>([]);
  const [busNumber, setBusNumber] = useState("");
  const [editBus, setEditBus] = useState<any>(null);
  const [editBusNumber, setEditBusNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBuses = async () => {
    const res = await fetchBuses();
    if (res.success) setBuses(res.data);
  };

  useEffect(() => {
    let ignore = false;
    fetchBuses().then((res) => {
      if (!ignore && res.success) setBuses(res.data);
    });
    return () => { ignore = true; };
  }, []);

  const handleCreate = async () => {
    if (!busNumber.trim()) return toast.error("Bus number is required");
    setLoading(true);
    const res = await createBus(busNumber.trim());
    setLoading(false);
    if (res.success) {
      toast.success("Bus created");
      setBusNumber("");
      loadBuses();
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
    <div className="w-full max-w-4xl space-y-6">
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
          {buses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No buses added yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Bus Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.map((bus) => (
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
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
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
