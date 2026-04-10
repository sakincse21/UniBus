export interface IUser {
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student" | "cr";
  batch?: {
    id: number;
    name: string;
  };
}

export interface INotice {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  forAll: boolean;
  forTeachers: boolean;
  eventDate?: string; // ISO date string for calendar integration
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
  targetBatch?: {
    id: number;
    name: string;
  };
  createdBy?: {
    user_id: string;
    name: string;
  };
}

export interface ICreateNotice {
  title: string;
  content: string;
  forAll?: boolean;
  forTeachers?: boolean;
  targetBatchId?: string;
  eventDate?: string; // ISO date string
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
}

export interface IBus {
  id: number;
  busNumber: string;
}

export interface IRoutePoint {
  sequence: number;
  lat: number;
  lng: number;
  minuteOffset: number;
}

export interface IBusEstimate {
  lat: number;
  lng: number;
  confidence: number;
  mode?: "live" | "estimated" | "not_started" | "ended";
  startTime?: string;
  endTime?: string;
}

export interface IBusTrackingResponse {
  isLive: boolean;
  points: IRoutePoint[];
  startTime: string | null;
  notifiedUsers: number;
  estimate: IBusEstimate | null;
}

export interface IBusLiveLocation {
  busId: number;
  lat: number;
  lng: number;
  isLive: boolean;
  confidence: number;
}

export interface IRoutineSlot {
  id?: number;
  day:
    | "saturday"
    | "sunday"
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday";
  firstHalfStart: string; // HH:mm
  secondHalfStart: string; // HH:mm
  confidence: number;
  note: string;
  confirmed?: boolean;
  remindersEnabled?: boolean;
}

// Calendar interfaces
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

export interface ICalendarEventSource {
  noticeId?: number;
  routineId?: number;
  fixtureId?: number;
}

export interface ICalendarEvent {
  id: string;
  type: "notice" | "routine" | "personal";
  title: string;
  description?: string;
  startDateTime: string; // ISO date string
  endDateTime?: string; // ISO date string
  isAllDay?: boolean;
  source: ICalendarEventSource;
  metadata?: ICalendarEventMetadata;
}

export interface IUserFixture {
  id: number;
  title: string;
  description?: string;
  isAllDay: boolean;
  startDateTime: string; // ISO date string
  endDateTime: string; // ISO date string
  user_id?: string;
}

export interface ICreateFixturePayload {
  title: string;
  description?: string;
  isAllDay: boolean;
  startDateTime: string; // ISO date string
  endDateTime: string; // ISO date string
}

export interface IUpdateFixturePayload {
  title?: string;
  description?: string;
  isAllDay?: boolean;
  startDateTime?: string; // ISO date string
  endDateTime?: string; // ISO date string
}
