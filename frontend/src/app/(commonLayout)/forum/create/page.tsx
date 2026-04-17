"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/components/RoleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createForumPost } from "@/lib/action/forum";
import { IForumPost } from "@/lib/interfaces";

export default function CreateForumPostPage() {
  const router = useRouter();
  const role = useRole();
  const isForumAllowed = role === "student" || role === "cr";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const postTitle = title.trim();
    const postContent = content.trim();

    if (!postTitle) {
      toast.error("Post title is required");
      return;
    }

    if (!postContent) {
      toast.error("Post content is required");
      return;
    }

    setSubmitting(true);

    try {
      const response = await createForumPost({
        title: postTitle,
        content: postContent,
      });

      if (!response.success) {
        toast.error(response.message || "Failed to create post");
        setSubmitting(false);
        return;
      }

      const created = response.data as IForumPost;
      toast.success("Post published");
      router.push(`/forum/${created.id}`);
    } catch {
      toast.error("Failed to create post");
      setSubmitting(false);
    }
  };

  if (!isForumAllowed) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Create Post</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The forum is available only for students and class representatives.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Create Post</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish a new thread in your batch forum.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/forum">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forum
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Enter a clear title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
            />
            <p className="text-xs text-muted-foreground">{title.length}/180</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <Textarea
              placeholder="Describe your topic"
              rows={10}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">{content.length}/5000</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/forum">Cancel</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Publishing..." : "Publish Post"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
