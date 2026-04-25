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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { fetchBuses } from "@/lib/action/bus";
import { fetchRoutes } from "@/lib/action/route";
import {
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/lib/action/schedule";

const ITEMS_PER_PAGE = 10;

export default function ScheduleManagementPage() {
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Create form
  const [selectedBusId, setSelectedBusId] = useState<string>("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Edit
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [editRouteId, setEditRouteId] = useState<string>("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const loadData = async () => {
    const [schedRes, busRes, routeRes] = await Promise.all([
      fetchSchedules(),
      fetchBuses(),
      fetchRoutes(),
    ]);
    if (schedRes.success) setAllSchedules(schedRes.data);
    if (busRes.success) setBuses(busRes.data);
    if (routeRes.success) setRoutes(routeRes.data);
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchSchedules(), fetchBuses(), fetchRoutes()]).then(
      ([schedRes, busRes, routeRes]) => {
        if (ignore) return;
        if (schedRes.success) setAllSchedules(schedRes.data);
        if (busRes.success) setBuses(busRes.data);
        if (routeRes.success) setRoutes(routeRes.data);
      }
    );
    return () => { ignore = true; };
  }, []);

  const totalPages = Math.ceil(allSchedules.length / ITEMS_PER_PAGE);
  const paginatedSchedules = allSchedules.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Filter out buses that already have schedules
  const availableBuses = buses.filter(
    (b) => !allSchedules.some((s) => s.bus?.id === b.id)
  );

  const handleCreate = async () => {
    if (!selectedBusId || !selectedRouteId || !startTime || !endTime) {
      return toast.error("All fields are required");
    }

    setLoading(true);
    const res = await createSchedule({
      busId: Number(selectedBusId),
      routeId: Number(selectedRouteId),
      startTime,
      endTime,
    });
    setLoading(false);

    if (res.success) {
      toast.success("Schedule created");
      setSelectedBusId("");
      setSelectedRouteId("");
      setStartTime("");
      setEndTime("");
      loadData();
    } else {
      toast.error(res.message || "Failed to create schedule");
    }
  };

  const handleUpdate = async () => {
    if (!editSchedule) return;
    setLoading(true);
    const res = await updateSchedule(editSchedule.id, {
      routeId: Number(editRouteId),
      startTime: editStartTime,
      endTime: editEndTime,
    });
    setLoading(false);

    if (res.success) {
      toast.success("Schedule updated");
      setEditSchedule(null);
      loadData();
    } else {
      toast.error(res.message || "Failed to update schedule");
    }
  };

  const handleDelete = async (id: number) => {
    const res = await deleteSchedule(id);
    if (res.success) {
      toast.success("Schedule deleted");
      loadData();
    } else {
      toast.error(res.message || "Failed to delete schedule");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bus</label>
              <Select value={selectedBusId} onValueChange={setSelectedBusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Bus" />
                </SelectTrigger>
                <SelectContent>
                  {availableBuses.map((bus) => (
                    <SelectItem key={bus.id} value={String(bus.id)}>
                      {bus.busNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Route</label>
              <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={String(route.id)}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={loading} className="mt-4">
            {loading ? "Creating..." : "Create Schedule"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {allSchedules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No schedules created yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{schedule.id}</TableCell>
                      <TableCell className="font-medium">
                        {schedule.bus?.busNumber || "N/A"}
                      </TableCell>
                      <TableCell>{schedule.route?.name || "N/A"}</TableCell>
                      <TableCell>{schedule.startTime}</TableCell>
                      <TableCell>{schedule.endTime}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditSchedule(schedule);
                            setEditRouteId(String(schedule.route?.id || ""));
                            setEditStartTime(schedule.startTime);
                            setEditEndTime(schedule.endTime);
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
                              <AlertDialogTitle>
                                Delete Schedule?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the schedule for bus{" "}
                                {schedule.bus?.busNumber}. This action cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(schedule.id)}
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


              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({allSchedules.length} total)
                </p>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>


      <Dialog
        open={!!editSchedule}
        onOpenChange={(open) => !open && setEditSchedule(null)}
      >
        <DialogContent>
          <DialogTitle>
            Edit Schedule — Bus {editSchedule?.bus?.busNumber}
          </DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Route</label>
              <Select value={editRouteId} onValueChange={setEditRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={String(route.id)}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Start Time
              </label>
              <Input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input
                type="time"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setEditSchedule(null)}
              >
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
