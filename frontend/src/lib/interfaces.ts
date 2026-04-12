export interface IUser {
  user_id: string;
  name: string;
  email: string;
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

export interface IRoutePoint {
  sequence: number;
  lat: number;
  lng: number;
  minuteOffset: number;
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
