import { useEffect, useState } from "react"
import { 
  Activity, 
  Users, 
  Pill, 
  FileText, 
  UserCheck, 
  Calendar,
  ChevronRight,
  Heart,
  LogOut,
  User,
  Settings,
  Database,
  Bell
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar"

const navigationItems = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: Activity,
    description: "Overview & Analytics"
  },
]

const managementItems = [
  {
    title: "Patients",
    url: "/patients",
    icon: Users,
    description: "Patient Management",
  },
  {
    title: "Medications",
    url: "/medications",
    icon: Pill,
    description: "Medication Tracking",
  },
  {
    title: "Reminders",
    url: "/reminders",
    icon: Bell,
    description: "Medication Reminders",
  },
  {
    title: "Medical Records",
    url: "/medical-records",
    icon: FileText,
    description: "Health History",
  },
  {
    title: "Caregivers",
    url: "/caregivers",
    icon: UserCheck,
    description: "Staff Management",
  },
  {
    title: "Schedules",
    url: "/schedule",
    icon: Calendar,
    description: "Shift Planning",
  },
]

const navigationItemsAfterManagement = [
  { 
    title: "Account Management", 
    url: "/account", 
    icon: Settings,
    description: "User Account Creation"
  },
  { 
    title: "Backup & Restore", 
    url: "/backup-restore", 
    icon: Database,
    description: "Data Backup & Recovery"
  },
  { 
    title: "Handover Reports", 
    url: "/endorsements", 
    icon: FileText,
    description: "Shift Reports & Care Handovers"
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const { userData, logout } = useAuth()
  const { setTheme } = useTheme()
  const location = useLocation()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"
  const isManagementRoute = managementItems.some((item) =>
    item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url)
  )
  const [managementOpen, setManagementOpen] = useState(isManagementRoute)
  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim() || userData?.email || 'Unknown User'

  useEffect(() => {
    if (isManagementRoute) {
      setManagementOpen(true)
    }
  }, [isManagementRoute])

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true
    if (path !== "/" && currentPath.startsWith(path)) return true
    return false
  }

  const getNavClasses = (path: string) => {
    const active = isActive(path)
    return active 
      ? "bg-white/15 !text-white border-r-2 border-white/70 font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" 
      : "hover:!bg-white/10 !text-white/80 hover:!text-white"
  }

  const handleLogout = async () => {
    try {
      setTheme('light')
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName || !lastName) return 'U'
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarContent className="bg-gradient-to-b from-purple-950 via-purple-900 to-purple-950 text-white border-r border-purple-800 shadow-[0_0_24px_rgba(76,29,149,0.35)]">
        {/* Header */}
        <div className={`h-16 border-b border-white/10 bg-purple-950/95 backdrop-blur px-4 ${collapsed ? 'flex items-center justify-center' : 'flex items-center'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="p-2 bg-white/10 rounded-lg ring-1 ring-white/15 shrink-0">
              <Heart className="h-6 w-6 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-semibold text-lg text-white">Care</h1>
                <p className="text-xs text-white/75">Healthcare Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="py-4">
          <SidebarGroupLabel className={collapsed ? "sr-only" : "text-white/95"}>
            Main Navigation
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12 !text-white hover:!bg-white/10 hover:!text-white">
                    <NavLink 
                      to={item.url} 
                      className={`${getNavClasses(item.url)} flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 hover:shadow-sm`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white">{item.title}</div>
                          <div className="text-xs text-white/75 truncate">
                            {item.description}
                          </div>
                        </div>
                      )}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="h-4 w-4 text-white" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  onClick={() => setManagementOpen((open) => !open)}
                  className="h-12 !text-white bg-transparent hover:!bg-white/10 hover:!text-white"
                  aria-expanded={managementOpen}
                >
                  <Settings className="h-5 w-5 flex-shrink-0 !text-white" />
                  {!collapsed && (
                    <div className="flex flex-1 items-center min-w-0">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-white">Management</div>
                        <div className="text-xs text-white/75 truncate">
                          Centralized operations
                        </div>
                      </div>
                    </div>
                  )}
                </SidebarMenuButton>

                {managementOpen && !collapsed && (
                  <SidebarMenuSub className="mt-1 ml-2">
                    {managementItems.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            `flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-none transition-colors ${
                              isActive
                                ? "bg-white/15 text-white"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
                            }`
                          }
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0 text-white" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>

              {navigationItemsAfterManagement.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12 !text-white hover:!bg-white/10 hover:!text-white">
                    <NavLink 
                      to={item.url} 
                      className={`${getNavClasses(item.url)} flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 hover:shadow-sm`}
                    >
                        <item.icon className="h-5 w-5 flex-shrink-0 !text-white" />
                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white">{item.title}</div>
                          <div className="text-xs text-white/75 truncate">
                            {item.description}
                          </div>
                        </div>
                      )}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="h-4 w-4 !text-white" />
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
              <div className="text-xs text-white/75">Quick</div>
              <div className="text-xs text-white/75">Access</div>
            </div>
          </div>
        )}
      </SidebarContent>

      {/* User Section */}
      <SidebarFooter className="border-t border-white/10 bg-purple-950/95 backdrop-blur">
        <div className="p-2">
          {userData && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={`w-full ${collapsed ? 'px-2' : 'justify-start px-3'} h-12 border border-white/10 bg-white/10 text-white shadow-sm hover:bg-white/15 hover:text-white`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-white/15 text-white">
                      {userData?.firstName && userData?.lastName 
                        ? getInitials(userData.firstName, userData.lastName)
                        : displayName.charAt(0).toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="ml-3 flex-1 text-left">
                      <div className="text-sm font-medium text-white">
                        {displayName}
                      </div>
                      <div className="text-xs text-white/75 capitalize">
                        {userData?.role || 'User'}
                      </div>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-purple-950 text-white border-purple-800 shadow-lg">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export interface UserData {
  firstName: string;
  lastName: string;
  role: string;
  profileImage?: string; // Add this line
  // other properties
}