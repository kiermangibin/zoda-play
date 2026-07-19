import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BarChart3,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Play,
  Shield,
  UserCog,
  Users,
  Trophy,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import zodaFavicon from "@/assets/zoda-favicon.png";

const missionNav = [
  { icon: LayoutDashboard, label: "Overview", to: "/mission" },
  { icon: Play, label: "Play", to: "/mission/play" },
  { icon: Trophy, label: "Rewards", to: "/mission/rewards" },
  { icon: Package, label: "Mission Bag", to: "/mission/bag" },
];

const adminNav = [
  { icon: BarChart3, label: "Track", to: "/admin" },
  { icon: Users, label: "Users", to: "/admin/members" },
  { icon: UserCog, label: "Admins", to: "/admin/users" },
];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const homeTo = auth.isAdmin ? "/admin" : "/mission";
  const navSections = [
    ...(auth.isAdmin ? [{ items: adminNav, label: "Admin" }] : []),
    { items: missionNav, label: "Mission" },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="p-3">
          <Link className="flex items-center gap-3 rounded-lg px-2 py-2" to={homeTo}>
            <img className="size-8 object-contain" src={zodaFavicon} alt="" aria-hidden="true" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-primary">
                ZODA
              </p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                Mission Control
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {navSections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.to}
                        tooltip={item.label}
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="p-3">
          <Separator className="bg-sidebar-border" />
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs font-black text-primary-foreground">
                {auth.currentUser ? getInitials(auth.currentUser.name) : "ZM"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-bold text-sidebar-foreground">
                {auth.currentUser?.name ?? "Mission Player"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {auth.currentUser?.email ?? "Signed out"}
              </p>
            </div>
            <Button
              aria-label="Log out"
              className="group-data-[collapsible=icon]:hidden"
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                auth.signOut();
                void navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator className="h-5" orientation="vertical" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
            <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          </div>
          <div className="ml-auto hidden items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary sm:flex">
            <Shield className="size-4" />
            Secured
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
