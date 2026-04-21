"use client";

import { useEffect, useState } from "react";
import { fetchBatches, createBatch, deleteBatch } from "@/lib/action/batch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

export default function ManageBatches() {
  const [batches, setBatches] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");

  const loadBatches = async () => {
    try {
      const data = await fetchBatches();
      setBatches(data.data || []);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) {
      return toast.error("Batch name is required");
    }

    try {
      setCreating(true);
      await createBatch({ name: newBatchName.trim() });
      toast.success("Batch created successfully");
      setNewBatchName("");
      await loadBatches();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create batch");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;
    
    try {
      setLoading(true);
      await deleteBatch(id);
      toast.success("Batch deleted successfully");
      await loadBatches();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="batchName">Batch Name (e.g. 2021)</Label>
              <Input
                id="batchName"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                placeholder="Enter batch name"
                disabled={creating}
              />
            </div>
            <Button type="submit" disabled={creating} onClick={handleCreate}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Batch"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : batches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No batches found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Batch Name</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.id}</TableCell>
                    <TableCell>{batch.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(batch.id)}
                        title="Delete Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
