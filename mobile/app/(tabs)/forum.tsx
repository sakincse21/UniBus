import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { forumAPI } from "@/lib/api";
import { IForumComment, IForumPost } from "@/interfaces";
import { useAuthStore } from "@/store/authStore";
import { APP_THEME_COLORS } from "@/lib/theme";

const COLORS = APP_THEME_COLORS;

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString();
}

export default function ForumTab() {
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuthStore();
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isForumAllowed = normalizedRole === "student" || normalizedRole === "cr";

  const [posts, setPosts] = useState<IForumPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const [createPostVisible, setCreatePostVisible] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<IForumPost | null>(null);
  const [comments, setComments] = useState<IForumComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  const loadPosts = useCallback(
    async (search: string, refresh: boolean = false) => {
      if (!isForumAllowed) {
        setPosts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await forumAPI.getPosts(search, 1, 30);
        setPosts((response.data?.data || []) as IForumPost[]);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setPosts([]);
          return;
        }
        Alert.alert("Error", "Failed to load forum posts.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isForumAllowed],
  );

  useEffect(() => {
    loadPosts(activeSearch);
  }, [activeSearch, loadPosts]);

  const handleSearch = () => {
    setActiveSearch(searchInput.trim());
  };

  const resetCreatePostForm = () => {
    setPostTitle("");
    setPostContent("");
    setIsCreatingPost(false);
  };

  const closeCreatePostModal = () => {
    setCreatePostVisible(false);
    resetCreatePostForm();
  };

  const handleCreatePost = async () => {
    const title = postTitle.trim();
    const content = postContent.trim();

    if (!title) {
      Alert.alert("Title Required", "Please enter a title for your post.");
      return;
    }

    if (!content) {
      Alert.alert("Content Required", "Please write some content for your post.");
      return;
    }

    setIsCreatingPost(true);

    try {
      const response = await forumAPI.createPost({ title, content });
      const created = response.data?.data as IForumPost | undefined;

      if (created) {
        if (activeSearch) {
          await loadPosts(activeSearch);
        } else {
          setPosts((prev) => [{ ...created, commentCount: created.commentCount || 0 }, ...prev]);
        }
      }

      closeCreatePostModal();
    } catch (error) {
      const fallback = "Failed to create post.";
      if (axios.isAxiosError(error)) {
        Alert.alert("Create Failed", error.response?.data?.message || fallback);
      } else {
        Alert.alert("Create Failed", fallback);
      }
      setIsCreatingPost(false);
    }
  };

  const closeCommentsModal = () => {
    setCommentsVisible(false);
    setSelectedPost(null);
    setComments([]);
    setCommentInput("");
    setIsLoadingComments(false);
    setIsPostingComment(false);
  };

  const loadComments = useCallback(async (postId: number) => {
    setIsLoadingComments(true);
    try {
      const response = await forumAPI.getComments(postId);
      setComments((response.data?.data || []) as IForumComment[]);
    } catch (error) {
      const fallback = "Failed to load comments.";
      if (axios.isAxiosError(error)) {
        Alert.alert("Error", error.response?.data?.message || fallback);
      } else {
        Alert.alert("Error", fallback);
      }
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  const handleOpenComments = async (post: IForumPost) => {
    setSelectedPost(post);
    setCommentsVisible(true);
    setCommentInput("");
    await loadComments(post.id);
  };

  const handleAddComment = async () => {
    if (!selectedPost) {
      return;
    }

    const content = commentInput.trim();

    if (!content) {
      Alert.alert("Comment Required", "Please write a comment before sending.");
      return;
    }

    setIsPostingComment(true);

    try {
      const response = await forumAPI.createComment(selectedPost.id, { content });
      const created = response.data?.data as IForumComment | undefined;

      if (created) {
        setComments((prev) => [...prev, created]);
        setCommentInput("");

        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                commentCount: (prev.commentCount || 0) + 1,
              }
            : prev,
        );

        setPosts((prev) =>
          prev.map((item) =>
            item.id === selectedPost.id
              ? { ...item, commentCount: (item.commentCount || 0) + 1 }
              : item,
          ),
        );
      }
    } catch (error) {
      const fallback = "Failed to add comment.";
      if (axios.isAxiosError(error)) {
        Alert.alert("Comment Failed", error.response?.data?.message || fallback);
      } else {
        Alert.alert("Comment Failed", fallback);
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  if (authLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: COLORS.background }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isForumAllowed) {
    return (
      <View className="flex-1 px-4" style={{ paddingTop: insets.top, backgroundColor: COLORS.background }}>
        <View
          className="rounded-xl p-4 mt-4"
          style={{
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.outline,
          }}
        >
          <Text className="text-xl font-extrabold" style={{ color: COLORS.onSurface }}>
            Forum
          </Text>
          <Text className="text-sm mt-2" style={{ color: COLORS.onSurfaceMuted }}>
            Forum is available only for students and class representatives.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: COLORS.background }}>
      <View className="px-4 pt-4 pb-3">
        <View
          className="rounded-xl p-4"
          style={{
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.outline,
          }}
        >
          <Text className="text-3xl font-extrabold" style={{ color: COLORS.onSurface }}>
            Batch Forum
          </Text>
          <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
            {user?.batch?.name
              ? `Discuss with Batch ${user.batch.name}`
              : "Discuss with students from your batch"}
          </Text>

          <View className="mt-4 flex-row items-center" style={{ gap: 8 }}>
            <View
              className="flex-1 rounded-lg px-3"
              style={{
                backgroundColor: COLORS.surfaceLow,
                borderWidth: 1,
                borderColor: COLORS.outline,
                minHeight: 42,
                justifyContent: "center",
              }}
            >
              <TextInput
                placeholder="Search posts"
                placeholderTextColor={COLORS.onSurfaceMuted}
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmitEditing={handleSearch}
                style={{ color: COLORS.onSurface, fontSize: 15 }}
                returnKeyType="search"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleSearch}
              className="rounded-lg px-3.5"
              style={{
                backgroundColor: COLORS.primary,
                borderWidth: 1,
                borderColor: COLORS.primary,
                minHeight: 42,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="search" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 78,
          paddingTop: 2,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadPosts(activeSearch, true)}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View
            className="items-center py-12 rounded-xl"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{
                backgroundColor: COLORS.primarySoft,
                borderWidth: 1,
                borderColor: "#9FC1FF",
              }}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
            </View>
            <Text className="text-lg font-bold mt-3" style={{ color: COLORS.onSurface }}>
              No posts yet
            </Text>
            <Text className="text-base mt-1 px-6 text-center" style={{ color: COLORS.onSurfaceMuted }}>
              Start a discussion for your batch.
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View
              key={post.id}
              className="rounded-xl p-4 mb-3"
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.outline,
              }}
            >
              <Text className="text-lg font-bold" style={{ color: COLORS.onSurface }}>
                {post.title}
              </Text>

              <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                {post.author?.name || "Unknown"} • Batch {post.batch?.name || "-"} • {formatDateTime(post.createdAt)}
              </Text>

              <Text className="text-sm mt-3 leading-5" style={{ color: COLORS.onSurface }}>
                {post.content}
              </Text>

              <View className="mt-4 flex-row">
                <TouchableOpacity
                  onPress={() => handleOpenComments(post)}
                  activeOpacity={0.86}
                  className="rounded-lg px-3 py-2 flex-row items-center"
                  style={{
                    backgroundColor: COLORS.surfaceLow,
                    borderWidth: 1,
                    borderColor: COLORS.outline,
                  }}
                >
                  <Feather name="message-circle" size={14} color={COLORS.onSurface} />
                  <Text className="ml-2 text-sm font-semibold" style={{ color: COLORS.onSurface }}>
                    Comments ({post.commentCount || 0})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => setCreatePostVisible(true)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Create forum post"
        style={{
          position: "absolute",
          right: 16,
          bottom: insets.bottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.primary,
          borderWidth: 1,
          borderColor: COLORS.primary,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 7,
        }}
      >
        <Feather name="plus" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={createPostVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreatePostModal}
      >
        <View
          className="flex-1 items-center justify-center px-5"
          style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
        >
          <View
            className="w-full rounded-xl p-4"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
              maxWidth: 430,
            }}
          >
            <Text className="text-xl font-extrabold" style={{ color: COLORS.onSurface }}>
              Create Post
            </Text>
            <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
              Share with students in your batch forum.
            </Text>

            <View className="mt-4">
              <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                Title
              </Text>
              <TextInput
                value={postTitle}
                onChangeText={setPostTitle}
                editable={!isCreatingPost}
                placeholder="Post title"
                placeholderTextColor={COLORS.onSurfaceMuted}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                  backgroundColor: COLORS.surfaceLow,
                  color: COLORS.onSurface,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              />
            </View>

            <View className="mt-3">
              <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                Content
              </Text>
              <TextInput
                value={postContent}
                onChangeText={setPostContent}
                editable={!isCreatingPost}
                multiline
                textAlignVertical="top"
                placeholder="Write your post"
                placeholderTextColor={COLORS.onSurfaceMuted}
                style={{
                  minHeight: 116,
                  paddingHorizontal: 12,
                  paddingTop: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                  backgroundColor: COLORS.surfaceLow,
                  color: COLORS.onSurface,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              />
            </View>

            <View className="flex-row mt-5" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={closeCreatePostModal}
                disabled={isCreatingPost}
                activeOpacity={0.86}
                className="flex-1 min-h-[42px] rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Text className="text-sm font-bold" style={{ color: COLORS.onSurfaceMuted }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={isCreatingPost}
                activeOpacity={0.86}
                className="flex-1 min-h-[42px] rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.primary,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                }}
              >
                {isCreatingPost ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold" style={{ color: "#FFFFFF" }}>
                    Post
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={commentsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCommentsModal}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
        >
          <View
            className="rounded-t-2xl px-4 pt-4 pb-4"
            style={{
              backgroundColor: COLORS.surface,
              borderTopWidth: 1,
              borderColor: COLORS.outline,
              maxHeight: "76%",
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-extrabold" style={{ color: COLORS.onSurface }}>
                  Comments
                </Text>
                <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                  {selectedPost?.title || "Selected post"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeCommentsModal}
                activeOpacity={0.86}
                className="w-9 h-9 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Feather name="x" size={16} color={COLORS.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="mt-3"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {isLoadingComments ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : comments.length === 0 ? (
                <View
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: COLORS.surfaceLow,
                    borderWidth: 1,
                    borderColor: COLORS.outline,
                  }}
                >
                  <Text className="text-sm" style={{ color: COLORS.onSurfaceMuted }}>
                    No comments yet.
                  </Text>
                </View>
              ) : (
                comments.map((comment) => (
                  <View
                    key={comment.id}
                    className="rounded-lg p-3 mb-2"
                    style={{
                      backgroundColor: COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: COLORS.outline,
                    }}
                  >
                    <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                      {comment.content}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                      {comment.author?.name || "Unknown"} • {formatDateTime(comment.createdAt)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
              <View
                className="flex-1 rounded-lg px-3"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                  minHeight: 42,
                  justifyContent: "center",
                }}
              >
                <TextInput
                  placeholder="Write a comment"
                  placeholderTextColor={COLORS.onSurfaceMuted}
                  value={commentInput}
                  onChangeText={setCommentInput}
                  editable={!isPostingComment}
                  style={{ color: COLORS.onSurface, fontSize: 15 }}
                />
              </View>

              <TouchableOpacity
                onPress={handleAddComment}
                disabled={isPostingComment}
                activeOpacity={0.86}
                className="rounded-lg px-3.5"
                style={{
                  backgroundColor: COLORS.primary,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  minHeight: 42,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isPostingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="send" size={15} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
