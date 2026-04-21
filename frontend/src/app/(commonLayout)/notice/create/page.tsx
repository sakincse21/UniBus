"use client";

import { useEffect, useState } from "react";
import {
  createNotice,
  fetchNoticeTags,
  uploadAttachments,
} from "@/lib/action/notice";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRole } from "@/components/RoleProvider";
import { X, Paperclip, FileText, Trash2 } from "lucide-react";
import Image from "next/image";
import type { INoticeTagOption, NoticeTag } from "@/lib/interfaces";

type AudienceType = "forAll" | "forTeachers" | "targetBatch";

interface AttachedFile {
  file: File;
  preview?: string;
  isImage: boolean;
}

const DEFAULT_TAG_OPTIONS: INoticeTagOption[] = [
  { value: "general", label: "General" },
  { value: "academic", label: "Academic" },
  { value: "exam", label: "Exam" },
  { value: "event", label: "Event" },
  { value: "transport", label: "Transport" },
  { value: "urgent", label: "Urgent" },
];

export default function CreateNoticePage() {
  const router = useRouter();
  const role = useRole();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AudienceType>("targetBatch");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [tag, setTag] = useState<NoticeTag>("general");
  const [tagOptions, setTagOptions] = useState<INoticeTagOption[]>(
    DEFAULT_TAG_OPTIONS,
  );
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  useEffect(() => {
    // Admin/teacher default to forAll, student/cr default to targetBatch
    if (role === "admin" || role === "teacher") {
      setAudience("forAll");
    } else {
      setAudience("targetBatch");
    }
  }, [role]);

  useEffect(() => {
    let isMounted = true;

    fetchNoticeTags()
      .then((res) => {
        if (!isMounted || !res.success || !Array.isArray(res.data) || res.data.length === 0) {
          return;
        }
        setTagOptions(res.data);
      })
      .catch(() => {
        // Keep default options if tag endpoint is temporarily unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const canSelectAllAudiences = role === "admin" || role === "teacher";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 50MB)`);
        return;
      }

      const isImage = file.type.startsWith("image/");
      const newAttachment: AttachedFile = {
        file,
        isImage,
      };

      // Create preview for images
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (event) => {
          newAttachment.preview = event.target?.result as string;
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, newAttachment]);
      }
    });

    // Reset input
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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
    try {
      const res = await createNotice({
        title,
        content,
        forAll: audience === "forAll",
        forTeachers: audience === "forTeachers",
        targetBatchId: audience === "targetBatch" ? targetBatchId : undefined,
        eventDate: eventDate || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        tag,
      });

      if (!res.success) {
        toast.error(res.message || "Failed to create notice");
        setLoading(false);
        return;
      }

      // Upload attachments if any
      if (attachments.length > 0) {
        setUploadingAttachments(true);
        const attachmentFiles = attachments.map((a) => a.file);
        const uploadRes = await uploadAttachments(res.data.id, attachmentFiles);
        setUploadingAttachments(false);

        if (!uploadRes.success) {
          toast.error("Notice created but some files failed to upload");
        }
      }

      toast.success(
        role === "student"
          ? "Notice submitted for approval"
          : "Notice created successfully"
      );
      router.push("/notice");
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Notice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compose a new notice for your audience
        </p>
      </div>


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

          <div className="space-y-2">
            <label className="text-sm font-medium">Tag</label>
            <Select
              value={tag}
              onValueChange={(value) => setTag(value as NoticeTag)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select notice tag" />
              </SelectTrigger>
              <SelectContent>
                {tagOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Event Date & Time (Optional)</label>
            <p className="text-xs text-muted-foreground">
              If you set a date, this notice will also appear as an event in the calendar.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              
              {eventDate && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">End Time</label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  {startTime && endTime && (
                    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
                      Showing time: {startTime} - {endTime}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
          <CardDescription>
            Upload files to attach to this notice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="*/*"
              />
              <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Paperclip className="w-5 h-5" />
                  <span className="text-sm">Click to upload files or drag and drop</span>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Max 10 files, 50MB each
                </p>
              </div>
            </label>
          </div>


          {attachments.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Attached Files ({attachments.length})
              </p>
              

              <div className="grid grid-cols-2 gap-3">
                {attachments
                  .filter((a) => a.isImage)
                  .map((attachment, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg overflow-hidden bg-muted"
                    >
                      <Image
                        src={attachment.preview as string}
                        alt={attachment.file.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => removeAttachment(index)}
                          className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs p-1 truncate text-gray-600 dark:text-gray-400 bg-white dark:bg-black/20">
                        {attachment.file.name}
                      </p>
                    </div>
                  ))}
              </div>


              {attachments.filter((a) => !a.isImage).length > 0 && (
                <div className="space-y-2">
                  {attachments
                    .filter((a) => !a.isImage)
                    .map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate">
                            {attachment.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({(attachment.file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
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
        <Button
          onClick={submit}
          disabled={loading || uploadingAttachments}
        >
          {uploadingAttachments
            ? "Uploading files..."
            : loading
            ? "Creating..."
            : role === "student"
            ? "Submit for Approval"
            : "Create Notice"}
        </Button>
      </div>
    </div>
  );
}
