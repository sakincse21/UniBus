import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { configs } from "@/lib/config.env"
import { RoleProvider } from "@/components/RoleProvider"

type UserRole = "admin" | "teacher" | "student" | "cr"

async function getServerUserRole(): Promise<UserRole | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) return null

  try {
    const secret = configs.JWT_SECRET
    if (!secret) return null

    const decoded = jwt.verify(token, secret) as any
    return decoded.role as UserRole
  } catch (error) {
    return null
  }
}

export default async function CommonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerUserRole()

  return (
    <RoleProvider role={role}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </header>
          <main className="flex flex-1 flex-col p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
