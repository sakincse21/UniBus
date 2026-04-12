"use client";

import React, { createContext, useContext, ReactNode } from "react";

type UserRole = "admin" | "teacher" | "student" | "cr";

const RoleContext = createContext<UserRole | null>(null);

export function RoleProvider({ role, children }: { role: UserRole | null; children: ReactNode }) {
  return (
    <RoleContext.Provider value={role}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
