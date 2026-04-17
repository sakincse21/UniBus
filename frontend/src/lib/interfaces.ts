export interface IUser {
  user_id: string;
  name: string;
  email: string;
  role?: "admin" | "teacher" | "student" | "cr";
  batch?: {
    id: number;
    name: string;
  } | null;
  starttime: string | null;
  endtime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IRegUser {
  name: string;
  email: string;
  password: string;
}

export type NoticeTag =
  | "general"
  | "academic"
  | "exam"
  | "event"
  | "transport"
  | "urgent";

export type NoticeSortBy = "timePosted" | "upcomingEvent" | "tag";
export type NoticeSortOrder = "asc" | "desc";

export interface INoticeTagOption {
  value: NoticeTag;
  label: string;
}

export interface INoticeAttachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface INotice {
  id: number;
  title: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  forAll: boolean;
  forTeachers: boolean;
  tag: NoticeTag;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  targetBatch?: {
    id: number;
    name: string;
  };
  createdBy?: {
    user_id: string;
    name: string;
    role?: "admin" | "teacher" | "student" | "cr";
  };
  attachments?: INoticeAttachment[];
}

export interface INoticeListResponse {
  success: boolean;
  data: INotice[];
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
  message?: string;
}

export interface INoticeResponse {
  success: boolean;
  data: INotice;
  message?: string;
}

export interface INoticeTagsResponse {
  success: boolean;
  data: INoticeTagOption[];
  message?: string;
}

export interface IRoutePoint {
  sequence: number;
  lat: number;
  lng: number;
  minuteOffset: number;
}

export interface IForumPost {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  batch: {
    id: number;
    name: string;
  };
  author: {
    user_id: string;
    name: string;
    role: "admin" | "teacher" | "student" | "cr";
  };
}

export interface IForumComment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    user_id: string;
    name: string;
    role: "admin" | "teacher" | "student" | "cr";
  };
}

export interface IForumPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface IForumPostsResponse {
  success: boolean;
  data: IForumPost[];
  meta: IForumPaginationMeta;
  message?: string;
}

export interface IForumPostResponse {
  success: boolean;
  data: IForumPost;
  message?: string;
}

export interface IForumCommentsResponse {
  success: boolean;
  data: IForumComment[];
  message?: string;
}

// Calendar Types
export interface ICalendarEventSource {
  noticeId?: number;
  routineId?: number;
  fixtureId?: number;
}

export interface ICalendarEventMetadata {
  forAll?: boolean;
  forTeachers?: boolean;
  batchId?: number;
  batchName?: string;
  confidence?: number;
  note?: string;
  noticeContent?: string;
  createdBy?: string;
  canDelete?: boolean;
}

export interface ICalendarEvent {
  id: string;
  type: "notice" | "routine" | "personal";
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  source: ICalendarEventSource;
  metadata?: ICalendarEventMetadata;
}

export interface IUserFixture {
  id: number;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateFixturePayload {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay: boolean;
}

export interface IUpdateFixturePayload {
  title?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  isAllDay?: boolean;
}
