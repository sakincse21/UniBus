"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { logoutFunc } from "@/lib/action/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useRole } from "./RoleProvider";

type UserRole = "admin" | "teacher" | "student" | "cr";

function getNavSections(role: UserRole | null) {
  const sections: { title: string; items: { title: string; url: string }[] }[] = [];

  if (!role) return sections;

  // ── Student / Teacher ──
  if (role === "student" || role === "teacher") {
    sections.push({
      title: "Navigation",
      items: [
        { title: "Buses", url: "/buses" },
        { title: "Notices", url: "/notice" },
      ],
    });
  }

  // ── CR ──
  if (role === "cr") {
    sections.push({
      title: "Navigation",
      items: [
        { title: "Buses", url: "/buses" },
        { title: "Notices", url: "/notice" },
        { title: "Create Notice", url: "/notice/create" },
      ],
    });
    sections.push({
      title: "Moderation",
      items: [
        { title: "Pending Notices", url: "/notice/pending" },
      ],
    });
  }

  // ── Admin ──
  if (role === "admin") {
    sections.push({
      title: "Navigation",
      items: [
        { title: "Buses", url: "/buses" },
        { title: "Notices", url: "/notice" },
        { title: "Create Notice", url: "/notice/create" },
      ],
    });
    sections.push({
      title: "Moderation",
      items: [
        { title: "Pending Notices", url: "/notice/pending" },
      ],
    });
    sections.push({
      title: "Management",
      items: [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Manage Buses", url: "/dashboard/buses" },
        { title: "Manage Routes", url: "/dashboard/routes" },
        { title: "Manage Schedules", url: "/dashboard/schedules" },
        { title: "Add User", url: "/dashboard/add-user" },
        { title: "Bulk Upload Users", url: "/dashboard/add-user/bulk" },
        { title: "Manage Users", url: "/dashboard/manage-users" },
      ],
    });
  }

  // Account — all roles
  sections.push({
    title: "Account",
    items: [{ title: "Profile", url: "/profile" }],
  });

  return sections;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useRouter();
  const pathname = usePathname();
  const role = useRole();

  async function handleLogout() {
    const res = await logoutFunc();
    if (res) {
      toast.success("Logged out successfully");
      navigate.push("/login");
    } else {
      toast.error("Failed to logout");
    }
  }

  const navSections = getNavSections(role);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="px-3 py-4">
          <h1 className="text-lg font-semibold tracking-tight">UniBus</h1>
          {role && (
            <span className="text-xs text-muted-foreground capitalize">
              {role}
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {role ? (
          navSections.map((section) => (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                      >
                        <Link href={item.url}>{item.title}</Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <div className="px-3 py-4 space-y-4">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          Log out
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
