/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchNoticeById,
  getAttachmentDownloadUrl,
  deleteNotice,
} from "@/lib/action/notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
} from "@/components/ui/alert-dialog";
import {
  Download,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Trash2,
} from "lucide-react";
import { useRole } from "@/components/RoleProvider";
import { toast } from "sonner";
import { formatBangladeshDate, formatBangladeshFromUTC } from "@/lib/dateTime";

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const role = useRole();
  const noticeId = params.id as string;

  const [notice, setNotice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!noticeId) return;

    fetchNoticeById(Number(noticeId))
      .then((res) => {
        if (res.success) {
          setNotice(res.data);
        } else {
          setError("Failed to load notice");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load notice");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [noticeId]);

  const isImage = (fileType: string): boolean => {
    return fileType.startsWith("image/");
  };

  const getFileIcon = (fileType: string) => {
    return isImage(fileType) ? (
      <ImageIcon className="w-4 h-4" />
    ) : (
      <FileText className="w-4 h-4" />
    );
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const result = await deleteNotice(Number(noticeId));
      if (result.success) {
        toast.success("Notice deleted successfully");
        router.push("/notice");
      } else {
        toast.error(result.message || "Failed to delete notice");
      }
    } catch {
      toast.error("Failed to delete notice");
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <div className="h-6 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {error || "Notice not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold">
                {notice.title}
              </CardTitle>
              <span className="text-sm text-muted-foreground whitespace-nowrap ml-0 mt-1 block">
                Created:{" "}
                {formatBangladeshFromUTC(notice.createdAt, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}{" "}
                {""}
              </span>
            </div>
            {(role === "admin" || role === "teacher" || role === "cr") && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteConfirm(true)}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          {notice.createdBy && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p>
                By{" "}
                <span className="font-medium">
                  {notice.createdBy.name || "Unknown"}
                </span>
                {notice.createdBy.role && (
                  <span className="ml-1 capitalize opacity-75">
                    ({notice.createdBy.role})
                  </span>
                )}
              </p>
              {notice.eventDate && (
                <p className="text-xs mt-1">
                  Event Date: {formatBangladeshDate(notice.eventDate)}
                </p>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {notice.content}
            </p>
          </div>

          {/* Attachments Section */}
          {notice.attachments && notice.attachments.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Attachments</h3>

              {/* Images Grid */}
              {notice.attachments.filter((a: any) => isImage(a.fileType))
                .length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Images
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {notice.attachments
                      .filter((a: any) => isImage(a.fileType))
                      .map((attachment: any, idx: number) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden bg-muted cursor-pointer"
                          onClick={() =>
                            setSelectedImage({
                              url: getAttachmentDownloadUrl(attachment.id),
                              title: attachment.fileName,
                            })
                          }
                        >
                          <img
                            src={getAttachmentDownloadUrl(attachment.id)}
                            alt={attachment.fileName}
                            className="w-full h-40 object-cover hover:opacity-75 transition-opacity"
                          />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={getAttachmentDownloadUrl(attachment.id)}
                              download={attachment.fileName}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full inline-flex"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* File List (non-images) */}
              {notice.attachments.filter((a: any) => !isImage(a.fileType))
                .length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Files
                  </p>
                  <div className="space-y-2">
                    {notice.attachments
                      .filter((a: any) => !isImage(a.fileType))
                      .map((attachment: any, idx: number) => (
                        <a
                          key={idx}
                          href={getAttachmentDownloadUrl(attachment.id)}
                          download={attachment.fileName}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                              {getFileIcon(attachment.fileType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {attachment.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(attachment.fileSize / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                        </a>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Modal */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              {selectedImage?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="relative bg-muted rounded-lg overflow-hidden flex justify-center">
            <img
              src={selectedImage?.url}
              alt={selectedImage?.title}
              className="max-h-96 object-contain"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedImage(null)}>
              Close
            </Button>
            <a href={selectedImage?.url} download={selectedImage?.title}>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notice? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
