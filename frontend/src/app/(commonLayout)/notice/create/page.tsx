"use client";

import { useEffect, useState } from "react";
import { createNotice } from "@/lib/action/notice";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useRole } from "@/components/RoleProvider";

type AudienceType = "forAll" | "forTeachers" | "targetBatch";

export default function CreateNoticePage() {
  const router = useRouter();
  const role = useRole();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AudienceType>("targetBatch");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Admin/teacher default to forAll, student/cr default to targetBatch
    if (role === "admin" || role === "teacher") {
      setAudience("forAll");
    } else {
      setAudience("targetBatch");
    }
  }, [role]);

  const canSelectAllAudiences = role === "admin" || role === "teacher";

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    if (audience === "targetBatch" && !targetBatchId.trim()) {
      toast.error("Please enter a batch name");
      return;
    }

    setLoading(true);
    const res = await createNotice({
      title,
      content,
      forAll: audience === "forAll",
      forTeachers: audience === "forTeachers",
      targetBatchId: audience === "targetBatch" ? targetBatchId : undefined,
    });
    setLoading(false);

    if (res.success) {
      toast.success(
        role === "student"
          ? "Notice submitted for approval"
          : "Notice created successfully"
      );
      router.push("/notice");
    } else {
      toast.error(res.message || "Failed to create notice");
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Notice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compose a new notice for your audience
        </p>
      </div>

      {/* Role-specific info banner */}
      {role === "student" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <span className="font-medium">Note:</span> Your notice will need
            approval from a CR or Admin before it becomes visible.
          </p>
        </div>
      )}
      {role === "cr" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            <span className="font-medium">Auto-approved:</span> As a CR, your
            notices are published immediately without review.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notice Details</CardTitle>
          <CardDescription>
            Fill in the title and content of your notice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Enter notice title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <Textarea
              placeholder="Write your notice content here..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience</CardTitle>
          <CardDescription>
            Select who should see this notice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canSelectAllAudiences ? (
            <RadioGroup
              value={audience}
              onValueChange={(val) => setAudience(val as AudienceType)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="forAll" id="forAll" />
                <label htmlFor="forAll" className="text-sm cursor-pointer">
                  Everyone
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="forTeachers" id="forTeachers" />
                <label htmlFor="forTeachers" className="text-sm cursor-pointer">
                  Teachers only
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="targetBatch" id="targetBatch" />
                <label htmlFor="targetBatch" className="text-sm cursor-pointer">
                  Specific batch
                </label>
              </div>
            </RadioGroup>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your notice will be sent to your batch.
            </p>
          )}

          {(audience === "targetBatch" || !canSelectAllAudiences) && (
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Batch Name</label>
              <Input
                placeholder="Enter batch name"
                value={targetBatchId}
                onChange={(e) => setTargetBatchId(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/notice")}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={loading}>
          {loading
            ? "Creating..."
            : role === "student"
              ? "Submit for Approval"
              : "Create Notice"}
        </Button>
      </div>
    </div>
  );
}
