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
}
