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
