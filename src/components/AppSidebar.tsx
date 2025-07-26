import { useState } from "react"
import { 
  Activity, 
  Users, 
  Pill, 
  FileText, 
  UserCheck, 
  Calendar,
  ChevronRight,
  Heart
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const navigationItems = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: Activity,
    description: "Overview & Analytics"
  },
  { 
    title: "Patients", 
    url: "/patients", 
    icon: Users,
    description: "Patient Management"
  },
  { 
    title: "Medications", 
    url: "/medications", 
    icon: Pill,
    description: "Medication Tracking"
  },
  { 
    title: "Medical Records", 
    url: "/medical-records", 
    icon: FileText,
    description: "Health History"
  },
  { 
    title: "Caregivers", 
    url: "/caregivers", 
    icon: UserCheck,
    description: "Staff Management"
  },
  { 
    title: "Schedules", 
    url: "/schedules", 
    icon: Calendar,
    description: "Shift Planning"
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true
    if (path !== "/" && currentPath.startsWith(path)) return true
    return false
  }

  const getNavClasses = (path: string) => {
    const active = isActive(path)
    return active 
      ? "bg-primary/10 text-primary border-r-2 border-primary font-medium" 
      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
  }

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarContent className="bg-card">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-semibold text-lg text-foreground">ElderFlow</h1>
                <p className="text-xs text-muted-foreground">Healthcare Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="py-4">
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Main Navigation
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12">
                    <NavLink 
                      to={item.url} 
                      className={`${getNavClasses(item.url)} flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </div>
                        </div>
                      )}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="h-4 w-4 text-primary" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Stats in collapsed mode */}
        {collapsed && (
          <div className="p-2 mt-auto">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Quick</div>
              <div className="text-xs text-muted-foreground">Access</div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}