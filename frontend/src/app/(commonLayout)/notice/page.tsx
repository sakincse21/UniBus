/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { fetchNotices, getAttachmentDownloadUrl } from "@/lib/action/notice";
import { getSocket } from "@/lib/socket";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, X, Image as ImageIcon, FileText } from "lucide-react";

export default function NoticePage() {
  const router = useRouter();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    fetchNotices().then((res) => {
      setNotices(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let socket: any;

    (async () => {
      socket = await getSocket();

      socket.on("notice_published", (notice: any) => {
        setNotices((prev) => [notice, ...prev]);
      });
    })();

    return () => {
      if (socket) socket.off("notice_published");
    };
  }, []);

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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
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
                              <img
                                src={getAttachmentDownloadUrl(attachment.id)}
                                alt={attachment.fileName}
                                className="w-full h-32 obj-cover hover:opacity-75 transition-opacity"
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
                                    {(
                                      attachment.fileSize /
                                      1024
                                    ).toFixed(1)}{" "}
                                    KB
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

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{selectedImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="relative bg-muted rounded-lg overflow-hidden">
            <img
              src={selectedImage?.url}
              alt={selectedImage?.title}
              className="max-h-96 mx-auto"
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
    </div>
  );
}
