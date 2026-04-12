/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { fetchNotices, getAttachmentDownloadUrl, deleteNotice } from "@/lib/action/notice";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Download, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
import { useRole } from "@/components/RoleProvider";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Image from "next/image";
import { formatBangladesh } from "@/lib/dateTime";

const ITEMS_PER_PAGE = 10;

export default function NoticePage() {
  const router = useRouter();
  const role = useRole();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchNotices(currentPage, ITEMS_PER_PAGE)
      .then((res) => {
        if (isMounted) {
          setNotices(res.data);
          setTotalPages(
            Math.ceil(
              (res.meta?.totalItems || res.data.length) / ITEMS_PER_PAGE,
            ),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  useEffect(() => {
    let socket: any;

    (async () => {
      socket = await getSocket();

      socket.on("notice_published", (notice: any) => {
        if (currentPage === 1) {
          setNotices((prev) => [notice, ...prev]);
        }
      });

      socket.on("notice_deleted", (data: any) => {
        setNotices((prev) => prev.filter((n) => n.id !== data.id));
      });
    })();

    return () => {
      if (socket) {
        socket.off("notice_published");
        socket.off("notice_deleted");
      }
    };
  }, [currentPage]);

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

  const handleDelete = async (id: number) => {
    try {
      setDeleting(true);
      const result = await deleteNotice(id);
      if (result.success) {
        setNotices((prev) => prev.filter((n) => n.id !== id));
        toast.success("Notice deleted successfully");
      } else {
        toast.error(result.message || "Failed to delete notice");
      }
    } catch {
      toast.error("Failed to delete notice");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Announcements and updates
          </p>
        </div>
        <Link href="/notice/create">
          <Button>New Notice</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notices?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No notices available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices?.map((n) => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium">
                      {n.title}
                    </CardTitle>
                    {n.createdBy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By {n.createdBy.name || "Unknown"}
                        {n.createdBy.role && (
                          <span className="ml-1 capitalize">
                            ({n.createdBy.role})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatBangladesh(n.createdAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/notice/${n.id}`)}
                    >
                      View
                    </Button>
                    {(role === "admin" || role === "teacher" || role === "cr") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteConfirm(n.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{n.content}</p>

                {/* Image Attachments Preview */}
                {n.attachments && n.attachments.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    {/* Images Grid */}
                    {n.attachments.filter((a: any) => isImage(a.fileType))
                      .length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {n.attachments
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
                              <Image
                                src={getAttachmentDownloadUrl(attachment.id)}
                                alt={attachment.fileName}
                                fill
                                className="object-cover hover:opacity-75 transition-opacity"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                onError={(e) => {
                                  console.error(
                                    "Image load failed:",
                                    attachment.id,
                                  );
                                  (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="160"%3E%3Crect fill="%23e5e7eb" width="200" height="160"/%3E%3C/svg%3E';
                                }}
                                onLoad={() => {
                                  console.log(
                                    "Image loaded successfully:",
                                    attachment.id,
                                  );
                                }}
                              />
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                  href={getAttachmentDownloadUrl(attachment.id)}
                                  download={attachment.fileName}
                                  className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full inline-flex"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* File List (non-images) */}
                    {n.attachments.filter((a: any) => !isImage(a.fileType))
                      .length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Files
                        </p>
                        {n.attachments
                          .filter((a: any) => !isImage(a.fileType))
                          .map((attachment: any, idx: number) => (
                            <a
                              key={idx}
                              href={getAttachmentDownloadUrl(attachment.id)}
                              download={attachment.fileName}
                              className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                                  {getFileIcon(attachment.fileType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">
                                    {attachment.fileName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {(attachment.fileSize / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
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
                onClick={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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
          <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-96 w-full h-96">
            {selectedImage?.url && (
              <Image
                src={selectedImage.url}
                alt={selectedImage?.title || "Preview"}
                fill
                className="object-contain hover:opacity-90 transition-opacity"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                priority
                onError={(e) => {
                  console.error("Modal image load failed:", selectedImage?.url);
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23e5e7eb" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="16" fill="%236b7280" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
                }}
                onLoad={() => {
                  console.log("Modal image loaded successfully");
                }}
              />
            )}
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
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
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
