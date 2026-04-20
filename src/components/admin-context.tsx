"use client";

import { createContext, useContext } from "react";

const AdminContext = createContext<{ unlocked: boolean }>({ unlocked: false });

export function AdminProvider({ unlocked, children }: { unlocked: boolean; children: React.ReactNode }) {
  return <AdminContext.Provider value={{ unlocked }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
