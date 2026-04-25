"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/components/RoleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createForumComment,
  deleteForumPost,
  fetchForumComments,
  fetchForumPostById,
  fetchForumViewerId,
  updateForumPost,
} from "@/lib/action/forum";
import { formatBangladesh } from "@/lib/dateTime";
import { IForumComment, IForumPost } from "@/lib/interfaces";

export default function ForumPostDetailPage() {
  const role = useRole();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isForumAllowed = role === "student" || role === "cr";
  const postId = Number(params?.id);

  const [post, setPost] = useState<IForumPost | null>(null);
  const [comments, setComments] = useState<IForumComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  const isValidPostId = useMemo(
    () => Number.isFinite(postId) && postId > 0,
    [postId],
  );

  const loadPostData = useCallback(async () => {
    if (!isValidPostId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    try {
      const [postResponse, commentsResponse] = await Promise.all([
        fetchForumPostById(postId),
        fetchForumComments(postId),
      ]);

      setPost(postResponse.data || null);
      setComments(commentsResponse.data || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "failed to load post";

      if (message.includes("not found")) {
        setNotFound(true);
      } else {
        toast.error("Failed to load post details");
      }
    } finally {
      setLoading(false);
    }
  }, [isValidPostId, postId]);

  useEffect(() => {
    if (!isForumAllowed) {
      setLoading(false);
      return;
    }

    loadPostData();
  }, [isForumAllowed, loadPostData]);

  useEffect(() => {
    if (!isForumAllowed) {
      setViewerId(null);
      return;
    }

    fetchForumViewerId()
      .then((id) => setViewerId(id))
      .catch(() => setViewerId(null));
  }, [isForumAllowed]);

  const isOwnPost = Boolean(post && viewerId && post.author?.user_id === viewerId);

  const startEditPost = () => {
    if (!post) {
      return;
    }

    setEditTitle(post.title);
    setEditContent(post.content);
    setIsEditingPost(true);
  };

  const cancelEditPost = () => {
    if (savingPostEdit) {
      return;
    }

    setIsEditingPost(false);
    setEditTitle("");
    setEditContent("");
  };

  const handleSavePostEdit = async () => {
    if (!post) {
      return;
    }

    const title = editTitle.trim();
    const content = editContent.trim();

    if (!title) {
      toast.error("Post title is required");
      return;
    }

    if (!content) {
      toast.error("Post content is required");
      return;
    }

    if (title.length > 180) {
      toast.error("Post title must be 180 characters or fewer");
      return;
    }

    if (content.length > 5000) {
      toast.error("Post content must be 5000 characters or fewer");
      return;
    }

    setSavingPostEdit(true);

    try {
      const response = await updateForumPost(post.id, { title, content });

      if (!response?.success) {
        toast.error(response?.message || "Failed to update post");
        return;
      }

      setPost((prev) =>
        prev
          ? {
              ...prev,
              title,
              content,
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      setIsEditingPost(false);
      toast.success("Post updated");
    } catch {
      toast.error("Failed to update post");
    } finally {
      setSavingPostEdit(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) {
      return;
    }

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Delete this post permanently?")
        : false;

    if (!confirmed) {
      return;
    }

    setDeletingPost(true);

    try {
      const response = await deleteForumPost(post.id);

      if (!response?.success) {
        toast.error(response?.message || "Failed to delete post");
        return;
      }

      toast.success("Post deleted");
      router.push("/forum");
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeletingPost(false);
    }
  };

  const handleAddComment = async () => {
    if (!post) {
      return;
    }

    const content = commentInput.trim();

    if (!content) {
      toast.error("Comment cannot be empty");
      return;
    }

    setPostingComment(true);

    try {
      const response = await createForumComment(post.id, { content });

      if (!response.success) {
        toast.error(response.message || "Failed to add comment");
        setPostingComment(false);
        return;
      }

      const created = response.data as IForumComment;
      setComments((prev) => [...prev, created]);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentCount: (prev.commentCount || 0) + 1,
            }
          : prev,
      );
      setCommentInput("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setPostingComment(false);
    }
  };

  if (!isForumAllowed) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Forum Post</CardTitle>
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto w-full space-y-3">
        <Card>
          <CardContent className="pt-6">
            <div className="h-5 w-56 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded mt-3" />
            <div className="h-4 w-4/5 bg-muted animate-pulse rounded mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto w-full space-y-4">
        <Button variant="outline" asChild>
          <Link href="/forum">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forum
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Post Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This post does not exist or is not available in your batch forum.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <Button variant="outline" asChild>
        <Link href="/forum">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Forum
        </Link>
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{post.title}</h1>
              <p className="text-xs text-muted-foreground">
                By {post.author?.name || "Unknown"} · Batch {post.batch?.name || "-"} · {" "}
                {formatBangladesh(post.createdAt, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {isOwnPost && !isEditingPost ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={startEditPost}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletingPost}
                  onClick={handleDeletePost}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {deletingPost ? "Deleting..." : "Delete"}
                </Button>
              </div>
            ) : null}
          </div>

          {isOwnPost && isEditingPost ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Title</p>
                <Input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={180}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Content</p>
                <Textarea
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  maxLength={5000}
                  className="min-h-36"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelEditPost}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePostEdit}
                  disabled={savingPostEdit}
                >
                  {savingPostEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments ({post.commentCount || comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border p-3">
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {comment.author?.name || "Unknown"} · {formatBangladesh(comment.createdAt, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Write a comment"
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={postingComment}
              onClick={handleAddComment}
            >
              <Send className="w-4 h-4 mr-1" />
              {postingComment ? "Sending..." : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
