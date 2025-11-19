"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalNotes: 0,
    totalEvents: 0,
    totalNotifications: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState({
    notesUploaded: 0,
    eventsCreated: 0,
    newUsers: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
    loadRecentActivity();
    loadWeeklyStats();
  }, []);

  async function checkAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase.from("users").select("*").eq("id", session.user.id).single();

    if (!userData?.is_admin) {
      await supabase.auth.signOut();
      router.push("/login");
      return;
    }

    setUser(userData);
    setLoading(false);
  }

  async function loadStats() {
    try {
      const [usersRes, notesRes, eventsRes, notificationsRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalNotes: notesRes.count || 0,
        totalEvents: eventsRes.count || 0,
        totalNotifications: notificationsRes.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async function loadRecentActivity() {
    try {
      const [notesRes, eventsRes, usersRes] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, created_at, subjects(name)")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("events")
          .select("id, title, created_at, is_published")
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("users")
          .select("id, name, created_at, branches(name)")
          .order("created_at", { ascending: false })
          .limit(2),
      ]);

      const activities: any[] = [];

      if (notesRes.data) {
        notesRes.data.forEach((note) => {
          activities.push({
            type: "note",
            title: `New note uploaded`,
            description: `${note.title} • ${(note.subjects as any)?.name || "Unknown Subject"}`,
            time: note.created_at,
            icon: "📝",
            color: "blue",
          });
        });
      }

      if (eventsRes.data) {
        eventsRes.data.forEach((event) => {
          activities.push({
            type: "event",
            title: event.is_published ? "Event published" : "Event created",
            description: event.title,
            time: event.created_at,
            icon: "🎉",
            color: "green",
          });
        });
      }

      if (usersRes.data) {
        usersRes.data.forEach((user) => {
          activities.push({
            type: "user",
            title: "New user registered",
            description: `${user.name} • ${(user.branches as any)?.name || "Unknown Branch"}`,
            time: user.created_at,
            icon: "👤",
            color: "purple",
          });
        });
      }

      // Sort by time and take the most recent 3
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activities.slice(0, 3));
    } catch (error) {
      console.error("Error loading recent activity:", error);
    }
  }

  async function loadWeeklyStats() {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoString = weekAgo.toISOString();

      const [notesRes, eventsRes, usersRes] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }).gte("created_at", weekAgoString),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("created_at", weekAgoString),
        supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", weekAgoString),
      ]);

      setWeeklyStats({
        notesUploaded: notesRes.count || 0,
        eventsCreated: eventsRes.count || 0,
        newUsers: usersRes.count || 0,
      });
    } catch (error) {
      console.error("Error loading weekly stats:", error);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.name}! Here's what's happening today.</p>
        </div>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users Card */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>

          {/* Total Notes Card */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-green-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">+8%</span>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Notes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalNotes}</p>
            </div>
          </div>

          {/* Total Events Card */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-purple-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">+5%</span>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Events</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
          </div>

          {/* Total Notifications Card */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-indigo-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-5 5v-5zM15 17H9a5 5 0 01-5-5V7a1 1 0 011-1h10a1 1 0 011 1v10z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Notifications</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalNotifications}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
              <p className="text-gray-500 text-sm mt-1">Manage your content efficiently</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/notes"
              className="group p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-blue-500/30">
                <span className="text-2xl">📚</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">Manage Notes</div>
              <div className="text-sm text-gray-500">View and upload notes</div>
            </Link>
            <Link
              href="/dashboard/syllabus"
              className="group p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-indigo-500/30">
                <span className="text-2xl">📘</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">Manage Syllabus</div>
              <div className="text-sm text-gray-500">Upload and verify syllabi</div>
            </Link>
            <Link
              href="/dashboard/events"
              className="group p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition-all duration-200 text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-purple-500/30">
                <span className="text-2xl">🎉</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">Manage Events</div>
              <div className="text-sm text-gray-500">Create and view events</div>
            </Link>
            <Link
              href="/dashboard/opportunities"
              className="group p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50/50 transition-all duration-200 text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-green-500/30">
                <span className="text-2xl">💼</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">Opportunities</div>
              <div className="text-sm text-gray-500">Manage jobs & internships</div>
            </Link>
            <Link
              href="/dashboard/users"
              className="group p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/50 transition-all duration-200 text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-amber-500/30">
                <span className="text-2xl">👥</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">Manage Users</div>
              <div className="text-sm text-gray-500">View all students</div>
            </Link>
          </div>
        </div>

        {/* Recent Activity & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
              <button
                onClick={() => {
                  loadRecentActivity();
                  loadWeeklyStats();
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.color === "blue"
                          ? "bg-blue-100"
                          : activity.color === "green"
                            ? "bg-green-100"
                            : activity.color === "purple"
                              ? "bg-purple-100"
                              : "bg-gray-100"
                      }`}
                    >
                      <span
                        className={`text-lg ${
                          activity.color === "blue"
                            ? "text-blue-600"
                            : activity.color === "green"
                              ? "text-green-600"
                              : activity.color === "purple"
                                ? "text-purple-600"
                                : "text-gray-600"
                        }`}
                      >
                        {activity.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.description} •{" "}
                        {new Date(activity.time).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>No recent activity to display</p>
                </div>
              )}
              <div className="mt-4 text-center">
                <Link
                  href="/dashboard/analytics"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  View Full Analytics
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-bold mb-6">This Week</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-100">Notes Uploaded</span>
                  <span className="text-2xl font-bold">{weeklyStats.notesUploaded}</span>
                </div>
                <div className="w-full bg-blue-400/30 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ width: `${Math.min((weeklyStats.notesUploaded / 50) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-100">Events Created</span>
                  <span className="text-2xl font-bold">{weeklyStats.eventsCreated}</span>
                </div>
                <div className="w-full bg-blue-400/30 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ width: `${Math.min((weeklyStats.eventsCreated / 20) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-100">New Users</span>
                  <span className="text-2xl font-bold">{weeklyStats.newUsers}</span>
                </div>
                <div className="w-full bg-blue-400/30 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ width: `${Math.min((weeklyStats.newUsers / 100) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
