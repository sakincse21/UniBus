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
import { useRouter } from "next/navigation";

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
    {
      title: "Bus Management",
      url: "#",
      items: [
        {
          title: "Buses",
          url: "/dashboard/buses",
        },
        {
          title: "Routes",
          url: "/dashboard/routes",
        },
        {
          title: "History",
          url: "/dashboard/history",
        },
      ],
    },
    {
      title: "User Management",
      url: "#",
      items: [
        {
          title: "Add User",
          url: "/dashboard/add-user",
        },
        {
          title: "Add Bulk Users",
          url: "/dashboard/add-user/bulk",
        },
        {
          title: "Manage Users",
          url: "/dashboard/manage-users",
        },
      ],
    },
    {
      title: "Profile Settings",
      url: "#",
      items: [
        {
          title: "Profile",
          url: "/profile",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useRouter()
  async function handleLogout() {
    const res = await logoutFunc();
    if (res) {
      toast.success("Logged out successfully!");
      navigate.refresh();
    } else {
      toast.error("Failed to logout");
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <h1 className="font-bold text-xl my-5 mx-2">UniBus Dashboard</h1>
        {/* <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
        <SearchForm /> */}
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url}>{item.title}</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" className="w-full" onClick={handleLogout}>
          Logout
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
