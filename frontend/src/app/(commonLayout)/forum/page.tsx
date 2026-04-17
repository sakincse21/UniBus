"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/components/RoleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { fetchForumPosts } from "@/lib/action/forum";
import { formatBangladesh } from "@/lib/dateTime";
import { IForumPaginationMeta, IForumPost } from "@/lib/interfaces";

const PAGE_SIZE = 10;

const EMPTY_META: IForumPaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
};

type PageToken = number | "ellipsis";

function getPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const tokens: PageToken[] = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) {
    tokens.push("ellipsis");
  }

  for (let page = left; page <= right; page += 1) {
    tokens.push(page);
  }

  if (right < totalPages - 1) {
    tokens.push("ellipsis");
  }

  tokens.push(totalPages);

  return tokens;
}

function getPreview(content: string): string {
  if (content.length <= 220) {
    return content;
  }

  return `${content.slice(0, 220)}...`;
}

export default function ForumPage() {
  const role = useRole();
  const isForumAllowed = role === "student" || role === "cr";

  const [posts, setPosts] = useState<IForumPost[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState<IForumPaginationMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async (page: number, search: string) => {
    setLoading(true);

    try {
      const res = await fetchForumPosts(search, page, PAGE_SIZE);

      setPosts(res.data || []);
      setMeta(res.meta || EMPTY_META);

      if (res.meta && page > res.meta.totalPages && res.meta.totalPages > 0) {
        setCurrentPage(res.meta.totalPages);
      }
    } catch {
      toast.error("Failed to load forum posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isForumAllowed) {
      setPosts([]);
      setMeta(EMPTY_META);
      setLoading(false);
      return;
    }

    loadPosts(currentPage, activeSearch);
  }, [activeSearch, currentPage, isForumAllowed, loadPosts]);

  const hasPosts = useMemo(() => posts.length > 0, [posts]);
  const pageTokens = useMemo(
    () => getPageTokens(currentPage, Math.max(meta.totalPages, 1)),
    [currentPage, meta.totalPages],
  );

  const rangeStart =
    meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd =
    meta.totalItems === 0 ? 0 : Math.min(meta.page * meta.limit, meta.totalItems);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    setActiveSearch(searchInput.trim());
  };

  if (!isForumAllowed) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Forum</CardTitle>
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
          <h1 className="text-2xl font-semibold">Batch Forum</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse posts from your batch.
          </p>
        </div>
        <Button asChild>
          <Link href="/forum/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              placeholder="Search posts by title, content, or author"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button type="submit" variant="outline" className="shrink-0">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="pt-6">
                <div className="h-4 w-56 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasPosts ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No forum posts found for your batch.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            return (
              <Card key={post.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold">
                        <Link href={`/forum/${post.id}`} className="hover:underline underline-offset-2">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
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
                    <Button variant="outline" asChild>
                      <Link href={`/forum/${post.id}`}>Open</Link>
                    </Button>
                  </div>

                  <p className="text-sm whitespace-pre-wrap">{getPreview(post.content)}</p>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={`/forum/${post.id}`}>
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Comments ({post.commentCount || 0})
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="pt-6 pb-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart}-{rangeEnd} of {meta.totalItems} posts.
              </p>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((prev) => prev - 1);
                        }
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {pageTokens.map((token, index) =>
                    token === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={token}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === token}
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(token);
                          }}
                        >
                          {token}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage < meta.totalPages) {
                          setCurrentPage((prev) => prev + 1);
                        }
                      }}
                      className={
                        currentPage >= meta.totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
