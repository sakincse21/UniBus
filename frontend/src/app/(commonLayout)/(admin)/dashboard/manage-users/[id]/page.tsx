"use client";
import UpdateUserForm from "@/components/module/admin/UpdateUser";
import { fetchUser } from "@/lib/action/user";
import { IUser } from "@/lib/interfaces";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const UserUpdatePage = () => {
  const params = useParams();
  const id = params.id;
  const [user, setUser] = useState<IUser|null>(null);

  const getUser = async (id: string) => {
    const user = await fetchUser(id);
    console.log(user);
    return user;
  };

  useEffect(() => {
    if (typeof id === "string") {
      getUser(id).then(user => setUser(user));
    }
  }, [id]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mx-auto">
      <UpdateUserForm user={user} />
    </div>
  );
};

export default UserUpdatePage;
