"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Users,
  Briefcase,
  Bell,
  BookOpen,
  Clock,
  Settings,
  LogOut,
  ChevronRight,
  BarChart3,
  Code,
  Monitor,
  Target,
  Bot,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Notes", href: "/dashboard/notes", icon: FileText },
  { name: "PYQs", href: "/dashboard/pyqs", icon: FileText },
  { name: "Subjects", href: "/dashboard/subjects", icon: BookOpen },
  { name: "Timetable", href: "/dashboard/timetable", icon: Clock },
  { name: "Events", href: "/dashboard/events", icon: Calendar },
  { name: "Opportunities", href: "/dashboard/opportunities", icon: Briefcase },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Branches", href: "/dashboard/branches", icon: Target },
];

const commonResourcesNavigation = [
  { name: "Overview", href: "/dashboard/common-resources", icon: BarChart3 },
  { name: "DSA Notes", href: "/dashboard/common-resources/dsa", icon: Code },
  { name: "Development", href: "/dashboard/common-resources/development", icon: Monitor },
  { name: "Placement Prep", href: "/dashboard/common-resources/placement", icon: Target },
  { name: "AI Tools", href: "/dashboard/common-resources/ai-tools", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 py-10">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 ">College Study Admin Portal</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"}
              `}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`} />
                <span>{item.name}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-blue-600" />}
            </Link>
          );
        })}

        {/* Common Resources Section */}
        <div className="pt-4">
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Common Resources</h3>
          </div>
          {commonResourcesNavigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"}
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`}
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-blue-600" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        <Link
          href="/dashboard/about"
          className="group flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all"
        >
          <Info className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
          <span>About</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full group flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
