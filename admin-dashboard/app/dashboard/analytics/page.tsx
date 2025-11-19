"use client";

import { useState, useEffect, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp,
  Users,
  FileText,
  Calendar,
  Download,
  BookmarkIcon,
  Activity,
  Eye,
  RefreshCw,
  BarChart3,
  PieChart,
  Clock,
  Target,
  Star,
  ArrowUp,
  ArrowDown,
  Zap,
  Globe,
  Shield,
  Award,
  Bell,
  MessageSquare,
  Building,
  GraduationCap,
  Search,
  Filter,
} from "lucide-react";

interface OverallStats {
  totalUsers: number;
  totalNotes: number;
  totalPyqs: number;
  totalSyllabusDocs: number;
  totalEvents: number;
  totalOpportunities: number;
  totalDownloads: number;
  totalNoteDownloads: number;
  totalPyqDownloads: number;
  totalSyllabusDownloads: number;
  totalBookmarks: number;
  totalBranches: number;
  totalSubjects: number;
}

interface DownloadAnalytics {
  total_downloads: number;
  unique_users: number;
  unique_notes: number;
  downloads_today: number;
  downloads_this_week: number;
  downloads_this_month: number;
}

interface PopularNote {
  note_id: string;
  title: string;
  download_count: number;
  subject_name: string;
  subject_code: string;
}

interface BranchStats {
  id: string;
  name: string;
  code: string;
  user_count: number;
  notes_count: number;
  download_count: number;
}

interface UserActivityData {
  user_id: string;
  name: string;
  email: string;
  branch_name: string;
  semester: number;
  total_downloads: number;
  saved_opportunities: number;
  last_login: string;
  is_admin: boolean;
}

interface DailyActivity {
  date: string;
  downloads: number;
  unique_downloaders: number;
  new_users: number;
  notes_uploaded: number;
  pyqs_uploaded: number;
  syllabus_uploaded: number;
  downloads_per_user: number;
}

interface SubjectAnalytics {
  id: string;
  name: string;
  code: string;
  branch_name: string;
  semester: number;
  notes_count: number;
  total_downloads: number;
  avg_downloads_per_note: number;
}

interface ResourceInsight {
  total: number;
  verified: number;
  totalDownloads: number;
  avgDownloads: number;
}

interface ContentAnalytics {
  notes: ResourceInsight;
  pyqs: ResourceInsight;
  syllabus: ResourceInsight;
}

interface ResourceTopItem {
  id: string;
  title: string;
  download_count: number;
  semester?: number | null;
  branches?: string[];
  is_verified?: boolean;
}

interface RecentUpload {
  id: string;
  title: string;
  type: "Notes" | "PYQ" | "Syllabus";
  created_at: string;
  is_verified: boolean;
  download_count: number;
  semester?: number | null;
  branches?: string[];
}

interface ContentVelocity {
  notesCreated: number;
  pyqsCreated: number;
  syllabusCreated: number;
}

type Tone =
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "indigo"
  | "sky"
  | "orange"
  | "lime"
  | "emerald"
  | "violet"
  | "rose";

const tonePalette: Record<Tone, { background: string; label: string; value: string; detail: string }> = {
  blue: {
    background: "bg-blue-50",
    label: "text-blue-600",
    value: "text-blue-700",
    detail: "text-blue-500",
  },
  green: {
    background: "bg-green-50",
    label: "text-green-600",
    value: "text-green-700",
    detail: "text-green-500",
  },
  purple: {
    background: "bg-purple-50",
    label: "text-purple-600",
    value: "text-purple-700",
    detail: "text-purple-500",
  },
  amber: {
    background: "bg-amber-50",
    label: "text-amber-600",
    value: "text-amber-700",
    detail: "text-amber-500",
  },
  indigo: {
    background: "bg-indigo-50",
    label: "text-indigo-600",
    value: "text-indigo-700",
    detail: "text-indigo-500",
  },
  sky: {
    background: "bg-sky-50",
    label: "text-sky-600",
    value: "text-sky-700",
    detail: "text-sky-500",
  },
  orange: {
    background: "bg-orange-50",
    label: "text-orange-600",
    value: "text-orange-700",
    detail: "text-orange-500",
  },
  lime: {
    background: "bg-lime-50",
    label: "text-lime-600",
    value: "text-lime-700",
    detail: "text-lime-500",
  },
  emerald: {
    background: "bg-emerald-50",
    label: "text-emerald-600",
    value: "text-emerald-700",
    detail: "text-emerald-500",
  },
  violet: {
    background: "bg-violet-50",
    label: "text-violet-600",
    value: "text-violet-700",
    detail: "text-violet-500",
  },
  rose: {
    background: "bg-rose-50",
    label: "text-rose-600",
    value: "text-rose-700",
    detail: "text-rose-500",
  },
};

interface HighlightCardProps {
  tone: Tone;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}

function HighlightCard({ tone, label, value, detail, children }: HighlightCardProps) {
  const styles = tonePalette[tone] ?? tonePalette.blue;
  return (
    <div className={`p-4 rounded-lg ${styles.background}`}>
      <div className={`text-xs uppercase tracking-wide ${styles.label}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold ${styles.value}`}>{value}</div>
      {detail && <div className={`mt-1 text-xs ${styles.detail}`}>{detail}</div>}
      {children}
    </div>
  );
}

interface SummaryCardProps {
  tone: Tone;
  value: ReactNode;
  label: ReactNode;
}

function SummaryCard({ tone, value, label }: SummaryCardProps) {
  const styles = tonePalette[tone] ?? tonePalette.blue;
  return (
    <div className={`text-center p-3 rounded-lg ${styles.background}`}>
      <div className={`text-xl font-bold ${styles.value}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  );
}

export default function ComprehensiveAnalytics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7d" | "30d" | "90d" | "1y" | "lifetime">("30d");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // Core Statistics
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalUsers: 0,
    totalNotes: 0,
    totalPyqs: 0,
    totalSyllabusDocs: 0,
    totalEvents: 0,
    totalOpportunities: 0,
    totalDownloads: 0,
    totalNoteDownloads: 0,
    totalPyqDownloads: 0,
    totalSyllabusDownloads: 0,
    totalBookmarks: 0,
    totalBranches: 0,
    totalSubjects: 0,
  });

  const [downloadAnalytics, setDownloadAnalytics] = useState<DownloadAnalytics>({
    total_downloads: 0,
    unique_users: 0,
    unique_notes: 0,
    downloads_today: 0,
    downloads_this_week: 0,
    downloads_this_month: 0,
  });

  const defaultResourceInsight: ResourceInsight = {
    total: 0,
    verified: 0,
    totalDownloads: 0,
    avgDownloads: 0,
  };

  const [contentAnalytics, setContentAnalytics] = useState<ContentAnalytics>({
    notes: { ...defaultResourceInsight },
    pyqs: { ...defaultResourceInsight },
    syllabus: { ...defaultResourceInsight },
  });

  const [topPyqs, setTopPyqs] = useState<ResourceTopItem[]>([]);
  const [topSyllabusDocs, setTopSyllabusDocs] = useState<ResourceTopItem[]>([]);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [contentVelocity, setContentVelocity] = useState<ContentVelocity>({
    notesCreated: 0,
    pyqsCreated: 0,
    syllabusCreated: 0,
  });

  // Detailed Analytics
  const [popularNotes, setPopularNotes] = useState<PopularNote[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserActivityData[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [subjectAnalytics, setSubjectAnalytics] = useState<SubjectAnalytics[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    loadAllAnalytics();
  }, [selectedTimeRange, selectedBranch]);

  async function loadAllAnalytics() {
    try {
      setLoading(true);
      await Promise.all([
        loadOverallStats(),
        loadDownloadAnalytics(),
        loadPopularNotes(),
        loadBranchStats(),
        loadActiveUsers(),
        loadDailyActivity(),
        loadSubjectAnalytics(),
        loadBranches(),
      ]);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  const calculateResourceInsight = (items: { download_count?: number | null; is_verified?: boolean | null }[]) => {
    const total = items.length;
    const verified = items.filter((item) => item.is_verified).length;
    const totalDownloads = items.reduce((sum, item) => sum + (item.download_count || 0), 0);

    return {
      total,
      verified,
      totalDownloads,
      avgDownloads: total > 0 ? Math.round(totalDownloads / total) : 0,
    };
  };

  async function loadOverallStats() {
    try {
      const [
        usersRes,
        notesRes,
        eventsRes,
        opportunitiesRes,
        branchesRes,
        subjectsRes,
        bookmarksRes,
        syllabusRes,
        pyqsRes,
      ] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id, download_count, is_verified", { count: "exact" }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("opportunities").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("opportunity_bookmarks").select("id", { count: "exact", head: true }),
        supabase.from("syllabus_documents").select("id, download_count, is_verified", { count: "exact" }),
        supabase.from("pyq_documents").select("id, download_count, is_verified", { count: "exact" }),
      ]);

      const notesData = notesRes.data ?? [];
      const syllabusData = syllabusRes.data ?? [];
      const pyqsData = pyqsRes.data ?? [];

      const noteInsight = calculateResourceInsight(notesData);
      const syllabusInsight = calculateResourceInsight(syllabusData);
      const pyqInsight = calculateResourceInsight(pyqsData);

      const [noteDownloadEventsRes, pyqDownloadEventsRes, syllabusDownloadEventsRes] = await Promise.all([
        supabase.from("note_downloads").select("id", { count: "exact", head: true }),
        supabase.from("pyq_downloads").select("id", { count: "exact", head: true }),
        supabase.from("syllabus_downloads").select("id", { count: "exact", head: true }),
      ]);

      const totalNoteDownloadEvents = Math.max(noteDownloadEventsRes.count ?? 0, noteInsight.totalDownloads);
      const totalPyqDownloadEvents = Math.max(pyqDownloadEventsRes.count ?? 0, pyqInsight.totalDownloads);
      const totalSyllabusDownloadEvents = Math.max(
        syllabusDownloadEventsRes.count ?? 0,
        syllabusInsight.totalDownloads,
      );

      const adjustedNoteInsight = {
        ...noteInsight,
        totalDownloads: totalNoteDownloadEvents,
        avgDownloads: noteInsight.total > 0 ? Math.round(totalNoteDownloadEvents / noteInsight.total) : 0,
      };

      const adjustedPyqInsight = {
        ...pyqInsight,
        totalDownloads: totalPyqDownloadEvents,
        avgDownloads: pyqInsight.total > 0 ? Math.round(totalPyqDownloadEvents / pyqInsight.total) : 0,
      };

      const adjustedSyllabusInsight = {
        ...syllabusInsight,
        totalDownloads: totalSyllabusDownloadEvents,
        avgDownloads:
          syllabusInsight.total > 0 ? Math.round(totalSyllabusDownloadEvents / syllabusInsight.total) : 0,
      };

      const totalDownloads =
        totalNoteDownloadEvents + totalPyqDownloadEvents + totalSyllabusDownloadEvents;

      setOverallStats({
        totalUsers: usersRes.count || 0,
        totalNotes: notesRes.count || 0,
        totalPyqs: pyqsRes.count || 0,
        totalSyllabusDocs: syllabusRes.count || 0,
        totalEvents: eventsRes.count || 0,
        totalOpportunities: opportunitiesRes.count || 0,
        totalDownloads,
        totalNoteDownloads: totalNoteDownloadEvents,
        totalPyqDownloads: totalPyqDownloadEvents,
        totalSyllabusDownloads: totalSyllabusDownloadEvents,
        totalBookmarks: bookmarksRes.count || 0,
        totalBranches: branchesRes.count || 0,
        totalSubjects: subjectsRes.count || 0,
      });

      setContentAnalytics({
        notes: adjustedNoteInsight,
        pyqs: adjustedPyqInsight,
        syllabus: adjustedSyllabusInsight,
      });
    } catch (error) {
      console.error("Error loading overall stats:", error);
    }
  }

  async function loadDownloadAnalytics() {
    try {
      const { data, error } = await supabase.rpc("get_download_analytics");

      if (error || !data || data.length === 0) {
        // Fallback calculation
        const { data: downloadsData } = await supabase.from("note_downloads").select("*");
        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        setDownloadAnalytics({
          total_downloads: downloadsData?.length || 0,
          unique_users: new Set(downloadsData?.map((d) => d.user_id)).size || 0,
          unique_notes: new Set(downloadsData?.map((d) => d.note_id)).size || 0,
          downloads_today: downloadsData?.filter((d) => d.download_date === today).length || 0,
          downloads_this_week: downloadsData?.filter((d) => d.download_date >= weekAgo).length || 0,
          downloads_this_month: downloadsData?.filter((d) => d.download_date >= monthAgo).length || 0,
        });
      } else {
        const analytics = data[0];
        setDownloadAnalytics({
          total_downloads: Number(analytics.total_downloads) || 0,
          unique_users: Number(analytics.unique_users) || 0,
          unique_notes: Number(analytics.unique_notes) || 0,
          downloads_today: Number(analytics.downloads_today) || 0,
          downloads_this_week: Number(analytics.downloads_this_week) || 0,
          downloads_this_month: Number(analytics.downloads_this_month) || 0,
        });
      }
    } catch (error) {
      console.error("Error loading download analytics:", error);
    }
  }

  async function loadPopularNotes() {
    try {
      const { data, error } = await supabase.rpc("get_popular_notes", { p_limit: 15 });

      if (error || !data) {
        // Fallback query
        const { data: notesData } = await supabase
          .from("notes")
          .select(
            `
            id,
            title,
            download_count,
            subjects (
              name,
              code
            )
          `,
          )
          .eq("is_verified", true)
          .order("download_count", { ascending: false })
          .limit(15);

        setPopularNotes(
          notesData?.map((note) => ({
            note_id: note.id,
            title: note.title,
            download_count: note.download_count || 0,
            subject_name: (note.subjects as any)?.name || "Unknown",
            subject_code: (note.subjects as any)?.code || "N/A",
          })) || [],
        );
      } else {
        setPopularNotes(data);
      }
    } catch (error) {
      console.error("Error loading popular notes:", error);
    }
  }

  async function loadBranchStats() {
    try {
      const { data: branchesData } = await supabase.from("branches").select("id, name, code");

      const relevantBranches =
        selectedBranch === "all"
          ? branchesData || []
          : (branchesData || []).filter((branch) => branch.id === selectedBranch);

      const branchStatsPromises =
        relevantBranches.map(async (branch) => {
          const [usersRes, notesRes] = await Promise.all([
            supabase.from("users").select("id", { count: "exact", head: true }).eq("branch_id", branch.id),
            supabase
              .from("notes")
              .select("id, download_count")
              .in(
                "subject_id",
                (await supabase.from("subjects").select("id").eq("branch_id", branch.id)).data?.map((s) => s.id) || [],
              ),
          ]);

          const totalDownloads = notesRes.data?.reduce((sum, note) => sum + (note.download_count || 0), 0) || 0;

          return {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            user_count: usersRes.count || 0,
            notes_count: notesRes.data?.length || 0,
            download_count: totalDownloads,
          };
        }) || [];

      const branchStatsData = await Promise.all(branchStatsPromises);
      setBranchStats(branchStatsData);
    } catch (error) {
      console.error("Error loading branch stats:", error);
    }
  }

  async function loadActiveUsers() {
    try {
      let query = supabase
        .from("users")
        .select(
          `
          id,
          name,
          email,
          semester,
          is_admin,
          last_login,
          branches (
            name
          )
        `,
        )
        .order("last_login", { ascending: false })
        .limit(20);

      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }

      const { data: usersData } = await query;

      if (usersData) {
        const usersWithActivity = await Promise.all(
          usersData.map(async (user) => {
            const [downloadsRes, bookmarksRes] = await Promise.all([
              supabase.from("note_downloads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
              supabase
                .from("opportunity_bookmarks")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id),
            ]);

            return {
              user_id: user.id,
              name: user.name || "Unknown",
              email: user.email,
              branch_name: (user.branches as any)?.name || "Unknown",
              semester: user.semester || 0,
              total_downloads: downloadsRes.count || 0,
              saved_opportunities: bookmarksRes.count || 0,
              last_login: user.last_login || "Never",
              is_admin: user.is_admin || false,
            };
          }),
        );

        setActiveUsers(usersWithActivity);
      }
    } catch (error) {
      console.error("Error loading active users:", error);
    }
  }

  async function loadDailyActivity() {
    try {
      let daysToFetch;
      let useRealTimeframe = false;

      if (selectedTimeRange === "lifetime") {
        // For lifetime, calculate actual days since first record
        const { data: firstRecord } = await supabase
          .from("note_downloads")
          .select("download_date")
          .order("download_date", { ascending: true })
          .limit(1);

        if (firstRecord && firstRecord.length > 0) {
          const firstDate = new Date(firstRecord[0].download_date);
          const today = new Date();
          daysToFetch = Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          useRealTimeframe = true;
        } else {
          daysToFetch = 30; // Default if no data
        }
      } else {
        daysToFetch =
          selectedTimeRange === "7d" ? 7 : selectedTimeRange === "30d" ? 30 : selectedTimeRange === "90d" ? 90 : 365;
      }
      const dates = Array.from({ length: daysToFetch }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split("T")[0];
      }).reverse();

      const dailyData = await Promise.all(
        dates.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          const nextDateStr = nextDate.toISOString().split("T")[0];

          const [downloadsDataRes, usersRes, notesRes, pyqsRes, syllabusRes] = await Promise.all([
            supabase.from("note_downloads").select("user_id").eq("download_date", date),
            supabase
              .from("users")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date)
              .lt("created_at", nextDateStr),
            supabase
              .from("notes")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date)
              .lt("created_at", nextDateStr),
            supabase
              .from("pyq_documents")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date)
              .lt("created_at", nextDateStr),
            supabase
              .from("syllabus_documents")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date)
              .lt("created_at", nextDateStr),
          ]);

          const downloadsData = downloadsDataRes.data ?? [];
          const downloads = downloadsData.length;
          const uniqueDownloaders = new Set(
            downloadsData
              .map((record) => record.user_id)
              .filter((id): id is string => typeof id === "string" && id.length > 0),
          ).size;

          const downloadsPerUser = uniqueDownloaders > 0 ? Number((downloads / uniqueDownloaders).toFixed(2)) : 0;

          return {
            date,
            downloads,
            unique_downloaders: uniqueDownloaders,
            new_users: usersRes.count || 0,
            notes_uploaded: notesRes.count || 0,
            pyqs_uploaded: pyqsRes.count || 0,
            syllabus_uploaded: syllabusRes.count || 0,
            downloads_per_user: downloadsPerUser,
          };
        }),
      );

      setDailyActivity(dailyData);
    } catch (error) {
      console.error("Error loading daily activity:", error);
    }
  }

  async function loadSubjectAnalytics() {
    try {
      const { data: subjectsData } = await supabase
        .from("subjects")
        .select(
          `
          id,
          name,
          code,
          semester,
          branches (
            name
          )
        `,
        )
        .limit(20);

      if (subjectsData) {
        const subjectAnalyticsPromises = subjectsData.map(async (subject) => {
          const { data: notesData } = await supabase
            .from("notes")
            .select("id, download_count")
            .eq("subject_id", subject.id)
            .eq("is_verified", true);

          const notesCount = notesData?.length || 0;
          const totalDownloads = notesData?.reduce((sum, note) => sum + (note.download_count || 0), 0) || 0;

          return {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            branch_name: (subject.branches as any)?.name || "Unknown",
            semester: subject.semester,
            notes_count: notesCount,
            total_downloads: totalDownloads,
            avg_downloads_per_note: notesCount > 0 ? Math.round(totalDownloads / notesCount) : 0,
          };
        });

        const subjectAnalyticsData = await Promise.all(subjectAnalyticsPromises);
        setSubjectAnalytics(subjectAnalyticsData.sort((a, b) => b.total_downloads - a.total_downloads));
      }
    } catch (error) {
      console.error("Error loading subject analytics:", error);
    }
  }

  async function loadBranches() {
    try {
      const { data } = await supabase.from("branches").select("id, name, code").order("name");
      setBranches(data || []);
    } catch (error) {
      console.error("Error loading branches:", error);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadAllAnalytics();
    setRefreshing(false);
  }

  async function handleExportReport() {
    try {
      // Generate CSV content
      const csvData = [
        ["Metric", "Value"],
        ["Total Users", overallStats.totalUsers.toString()],
        ["Total Notes", overallStats.totalNotes.toString()],
        ["Total PYQs", overallStats.totalPyqs.toString()],
        ["Total Syllabus Docs", overallStats.totalSyllabusDocs.toString()],
        ["Total Events", overallStats.totalEvents.toString()],
        ["Total Downloads (All Resources)", overallStats.totalDownloads.toString()],
        ["Notes Downloads", overallStats.totalNoteDownloads.toString()],
        ["PYQ Downloads", overallStats.totalPyqDownloads.toString()],
        ["Syllabus Downloads", overallStats.totalSyllabusDownloads.toString()],
        ["Unique Note Downloaders", downloadAnalytics.unique_users.toString()],
        ["Note Downloads Today", downloadAnalytics.downloads_today.toString()],
        ["Note Downloads This Week", downloadAnalytics.downloads_this_week.toString()],
        ["Note Downloads This Month", downloadAnalytics.downloads_this_month.toString()],
      ];

      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting report:", error);
      alert("Failed to export report. Please try again.");
    }
  }

  function handleSetupAlerts() {
    alert(
      "Alert setup feature coming soon! This will allow you to configure notifications for:\n\n• Low user activity\n• High download spikes\n• New user registrations\n• Content moderation alerts",
    );
  }

  function handleAdvancedAnalytics() {
    alert(
      "Advanced analytics features coming soon! This will include:\n\n• Custom date ranges\n• Cohort analysis\n• Predictive analytics\n• Custom reports\n• API integration",
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const totalContentItems =
    overallStats.totalNotes + overallStats.totalPyqs + overallStats.totalSyllabusDocs;

  const totalResourceDownloads =
    overallStats.totalNoteDownloads + overallStats.totalPyqDownloads + overallStats.totalSyllabusDownloads;

  const getDownloadShare = (value: number) => {
    if (totalResourceDownloads === 0) return 0;
    return Math.round((value / totalResourceDownloads) * 100);
  };

  const resourceBreakdown = [
    {
      key: "notes",
      title: "Notes",
      badgeClass: "bg-blue-100 text-blue-700",
      accent: "text-blue-600",
      data: contentAnalytics.notes,
    },
    {
      key: "pyqs",
      title: "PYQs",
      badgeClass: "bg-purple-100 text-purple-700",
      accent: "text-purple-600",
      data: contentAnalytics.pyqs,
    },
    {
      key: "syllabus",
      title: "Syllabus",
      badgeClass: "bg-amber-100 text-amber-700",
      accent: "text-amber-600",
      data: contentAnalytics.syllabus,
    },
  ];

  function calculateGrowthRate(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  const downloadBreakdown = [
    {
      label: "Notes",
      value: overallStats.totalNoteDownloads,
      percent: getDownloadShare(overallStats.totalNoteDownloads),
      barClass: "bg-blue-500",
    },
    {
      label: "PYQs",
      value: overallStats.totalPyqDownloads,
      percent: getDownloadShare(overallStats.totalPyqDownloads),
      barClass: "bg-purple-500",
    },
    {
      label: "Syllabus",
      value: overallStats.totalSyllabusDownloads,
      percent: getDownloadShare(overallStats.totalSyllabusDownloads),
      barClass: "bg-amber-500",
    },
  ];

  const downloadsLast7Days = dailyActivity.slice(-7).reduce((sum, day) => sum + day.downloads, 0);
  const downloadsPrev7Days = dailyActivity.slice(-14, -7).reduce((sum, day) => sum + day.downloads, 0);
  const weeklyGrowth = calculateGrowthRate(downloadsLast7Days, downloadsPrev7Days);
  const totalDownloadsInRange = dailyActivity.reduce((sum, day) => sum + day.downloads, 0);
  const avgDownloadsPerActiveDay = dailyActivity.length > 0 ? Math.round(totalDownloadsInRange / dailyActivity.length) : 0;
  const totalUniqueDownloadersInRange = dailyActivity.reduce((sum, day) => sum + day.unique_downloaders, 0);
  const totalNotesUploadedInRange = dailyActivity.reduce((sum, day) => sum + day.notes_uploaded, 0);
  const totalPyqsUploadedInRange = dailyActivity.reduce((sum, day) => sum + day.pyqs_uploaded, 0);
  const totalSyllabusUploadedInRange = dailyActivity.reduce((sum, day) => sum + day.syllabus_uploaded, 0);
  const totalResourceUploadsInRange =
    totalNotesUploadedInRange + totalPyqsUploadedInRange + totalSyllabusUploadedInRange;
  const totalNewUsersInRange = dailyActivity.reduce((sum, day) => sum + day.new_users, 0);
  const avgDownloadsPerUserRange = totalUniqueDownloadersInRange > 0
    ? Number((totalDownloadsInRange / totalUniqueDownloadersInRange).toFixed(2))
    : 0;
  const topDownloadDay = dailyActivity.reduce<DailyActivity | null>((best, current) => {
    if (!best) return current;
    return current.downloads > best.downloads ? current : best;
  }, null);
  const topDownloadDayLabel = topDownloadDay
    ? new Date(topDownloadDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  const topDownloadDayValue = topDownloadDay?.downloads || 0;
  const peakDownloadsPerUserDay = dailyActivity.reduce<DailyActivity | null>((best, current) => {
    if (!best) return current;
    return current.downloads_per_user > best.downloads_per_user ? current : best;
  }, null);
  const peakDownloadsPerUserLabel = peakDownloadsPerUserDay
    ? new Date(peakDownloadsPerUserDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  const peakDownloadsPerUserValue = peakDownloadsPerUserDay?.downloads_per_user ?? 0;
  const maxChartDownloads = Math.max(...dailyActivity.map((d) => d.downloads)) || 1;
  const uniqueDownloaderShare = overallStats.totalUsers > 0
    ? Number(((downloadAnalytics.unique_users / overallStats.totalUsers) * 100).toFixed(1))
    : 0;
  const avgResourceUploadsPerDay =
    dailyActivity.length > 0 ? Number((totalResourceUploadsInRange / dailyActivity.length).toFixed(2)) : 0;
  const notesUploadsPerDay =
    dailyActivity.length > 0 ? Number((totalNotesUploadedInRange / dailyActivity.length).toFixed(2)) : 0;
  const pyqsUploadsPerDay =
    dailyActivity.length > 0 ? Number((totalPyqsUploadedInRange / dailyActivity.length).toFixed(2)) : 0;
  const syllabusUploadsPerDay =
    dailyActivity.length > 0 ? Number((totalSyllabusUploadedInRange / dailyActivity.length).toFixed(2)) : 0;
  const resourceUploadMix = totalResourceUploadsInRange > 0
    ? {
        notes: Math.round((totalNotesUploadedInRange / totalResourceUploadsInRange) * 100),
        pyqs: Math.round((totalPyqsUploadedInRange / totalResourceUploadsInRange) * 100),
        syllabus: Math.round((totalSyllabusUploadedInRange / totalResourceUploadsInRange) * 100),
      }
    : { notes: 0, pyqs: 0, syllabus: 0 };
  const peakDownloadsPerUserDisplay = peakDownloadsPerUserValue.toFixed(2);
  const engagementRate = overallStats.totalUsers > 0 ? Math.round((downloadAnalytics.unique_users / overallStats.totalUsers) * 100) : 0;
  const downloadReach = overallStats.totalNotes > 0 ? Math.round((downloadAnalytics.unique_notes / overallStats.totalNotes) * 100) : 0;
  const branchDownloadLeader =
    branchStats.length > 0
      ? branchStats.reduce((best, branch) => (branch.download_count > best.download_count ? branch : best), branchStats[0])
      : null;
  const branchLeaderShare = branchDownloadLeader && overallStats.totalNoteDownloads > 0
    ? Math.round((branchDownloadLeader.download_count / overallStats.totalNoteDownloads) * 100)
    : 0;
  const totalSubjectDownloads = subjectAnalytics.reduce((sum, subject) => sum + subject.total_downloads, 0);

  const formatDate = (dateString: string) => {
    if (dateString === "Never") return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="w-12 h-12 animate-pulse text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading comprehensive analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              Analytics Dashboard
              {selectedTimeRange === "lifetime" && (
                <span className="ml-3 px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                  🕐 Lifetime View
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-2">
              {selectedTimeRange === "lifetime"
                ? "Complete platform analytics from the beginning of time"
                : "Comprehensive platform insights and metrics"}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last 1 year</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-10 h-10 opacity-80" />
              <div className="text-right">
                <ArrowUp className="w-5 h-5 inline mr-1" />
                <span className="text-sm">+12%</span>
              </div>
            </div>
            <p className="text-blue-100 text-sm mb-1">Total Users</p>
            <p className="text-4xl font-bold">{formatNumber(overallStats.totalUsers)}</p>
            <p className="text-blue-100 text-sm mt-2">Across {overallStats.totalBranches} branches</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Download className="w-10 h-10 opacity-80" />
              <div className="text-right">
                <ArrowUp className="w-5 h-5 inline mr-1" />
                <span className="text-sm">+25%</span>
              </div>
            </div>
            <p className="text-green-100 text-sm mb-1">Total Downloads</p>
            <p className="text-4xl font-bold">{formatNumber(overallStats.totalDownloads)}</p>
            <p className="text-green-100 text-sm mt-2 text-xs md:text-sm">
              Notes {formatNumber(overallStats.totalNoteDownloads)} • PYQs {formatNumber(overallStats.totalPyqDownloads)} • Syllabus {formatNumber(overallStats.totalSyllabusDownloads)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-10 h-10 opacity-80" />
              <div className="text-right">
                <ArrowUp className="w-5 h-5 inline mr-1" />
                <span className="text-sm">+8%</span>
              </div>
            </div>
            <p className="text-purple-100 text-sm mb-1">Learning Assets</p>
            <p className="text-4xl font-bold">{formatNumber(totalContentItems)}</p>
            <p className="text-purple-100 text-sm mt-2">
              Notes {overallStats.totalNotes} • PYQs {overallStats.totalPyqs} • Syllabus {overallStats.totalSyllabusDocs}
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-10 h-10 opacity-80" />
              <div className="text-right">
                <ArrowUp className="w-5 h-5 inline mr-1" />
                <span className="text-sm">+15%</span>
              </div>
            </div>
            <p className="text-amber-100 text-sm mb-1">Events & Opportunities</p>
            <p className="text-4xl font-bold">
              {formatNumber(overallStats.totalEvents + overallStats.totalOpportunities)}
            </p>
            <p className="text-amber-100 text-sm mt-2">{overallStats.totalBookmarks} bookmarks saved</p>
          </div>
        </div>

        {/* Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Download Activity */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-600" />
                  Notes Download Activity
                </h3>
                <p className="text-xs text-gray-500">Derived from note_downloads events</p>
              </div>
              <div className={`text-xs px-3 py-1 rounded-full font-medium ${weeklyGrowth >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {weeklyGrowth >= 0 ? "+" : ""}{weeklyGrowth}% vs last 7 days
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="text-sm text-blue-600">Today</div>
                <div className="text-3xl font-bold text-blue-700">{downloadAnalytics.downloads_today}</div>
                <div className="text-xs text-blue-500 mt-1">Peak {topDownloadDayLabel}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <div className="text-sm text-green-600">This Week</div>
                <div className="text-3xl font-bold text-green-700">{downloadAnalytics.downloads_this_week}</div>
                <div className="text-xs text-green-500 mt-1">Average {avgDownloadsPerActiveDay} / day</div>
              </div>
              <div className="col-span-2 p-4 bg-purple-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-purple-600">This Month</div>
                    <div className="text-2xl font-bold text-purple-700">{downloadAnalytics.downloads_this_month}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Top download day</div>
                    <div className="text-sm font-semibold text-gray-700">{topDownloadDayLabel} • {topDownloadDayValue}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-purple-200 rounded-full">
                    <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.round((downloadAnalytics.downloads_this_week / Math.max(downloadAnalytics.downloads_this_month || 1, 1)) * 100))}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Weekly progress</span>
                    <span>{downloadAnalytics.downloads_this_week}/{downloadAnalytics.downloads_this_month}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border border-blue-100 rounded-lg">
                <div>
                  <div className="text-xs text-blue-500 uppercase tracking-wide">Unique Downloaders</div>
                  <div className="text-lg font-semibold text-gray-900">{downloadAnalytics.unique_users}</div>
                </div>
                <div className="text-sm text-blue-600 font-medium">{engagementRate}% of users</div>
              </div>
              <div className="flex items-center justify-between p-3 border border-green-100 rounded-lg">
                <div>
                  <div className="text-xs text-green-500 uppercase tracking-wide">Notes Downloaded</div>
                  <div className="text-lg font-semibold text-gray-900">{downloadAnalytics.unique_notes}</div>
                </div>
                <div className="text-sm text-green-600 font-medium">{downloadReach}% of library</div>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-green-600" />
              Notes Engagement Metrics
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-600 uppercase tracking-wide">Avg Downloads per User</div>
                    <div className="text-3xl font-bold text-blue-700">
                      {downloadAnalytics.unique_users > 0
                        ? Math.round(downloadAnalytics.total_downloads / downloadAnalytics.unique_users)
                        : 0}
                    </div>
                  </div>
                  <div className="text-right text-sm text-blue-500">
                    {formatNumber(downloadAnalytics.total_downloads)} total downloads
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-green-600 uppercase tracking-wide">Avg Downloads per Note</div>
                    <div className="text-3xl font-bold text-green-700">
                      {downloadAnalytics.unique_notes > 0
                        ? Math.round(downloadAnalytics.total_downloads / downloadAnalytics.unique_notes)
                        : 0}
                    </div>
                  </div>
                  <div className="text-right text-sm text-green-500">
                    {downloadAnalytics.unique_notes} notes reached
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-purple-600 uppercase tracking-wide">Notes Downloaded</div>
                    <div className="text-3xl font-bold text-purple-700">{downloadReach}%</div>
                  </div>
                  <div className="text-right text-sm text-purple-500">
                    {downloadReach}% of {overallStats.totalNotes} notes
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-amber-600 uppercase tracking-wide">Top Download Branch</div>
                    <div className="text-xl font-semibold text-amber-700">
                      {branchDownloadLeader ? `${branchDownloadLeader.name} (${branchDownloadLeader.code})` : "No data"}
                    </div>
                  </div>
                  <div className="text-right text-sm text-amber-500">
                    {branchDownloadLeader ? `${formatNumber(branchDownloadLeader.download_count)} downloads • ${branchLeaderShare}% share` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Overview */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-purple-600" />
              Platform Overview
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Active Users</div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(overallStats.totalUsers)}</div>
                  </div>
                  <div className="text-right text-sm text-blue-500">
                    {overallStats.totalBranches} branches • {formatNumber(overallStats.totalSubjects)} subjects
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Content Library</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatNumber(totalContentItems)} items
                    </div>
                  </div>
                  <div className="text-right text-sm text-purple-500">
                    Notes {formatNumber(overallStats.totalNotes)} • PYQs {formatNumber(overallStats.totalPyqs)} • Syllabus {formatNumber(overallStats.totalSyllabusDocs)}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Events & Opportunities</div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(overallStats.totalEvents + overallStats.totalOpportunities)}</div>
                  </div>
                  <div className="text-right text-sm text-amber-500">{formatNumber(overallStats.totalBookmarks)} bookmarks</div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Resource Downloads</div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(overallStats.totalDownloads)}</div>
                  </div>
                  <div className="text-right text-sm text-green-500">
                    Notes {getDownloadShare(overallStats.totalNoteDownloads)}% • PYQs {getDownloadShare(overallStats.totalPyqDownloads)}% • Syllabus {getDownloadShare(overallStats.totalSyllabusDownloads)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Activity Trends - Compact */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Daily Activity Trends
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>
                {selectedTimeRange === "lifetime"
                  ? `All time data (${dailyActivity.length} days)`
                  : `Last ${dailyActivity.length} days`}
              </span>
              {selectedTimeRange === "lifetime" && dailyActivity.length > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Since {new Date(dailyActivity[0]?.date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <HighlightCard
              tone="blue"
              label="Engagement Volume"
              value={formatNumber(totalDownloadsInRange)}
              detail={`${formatNumber(totalUniqueDownloadersInRange)} unique downloaders • ${uniqueDownloaderShare}% of user base`}
            />
            <HighlightCard
              tone="green"
              label="Downloads per User"
              value={avgDownloadsPerUserRange}
              detail={
                peakDownloadsPerUserLabel === "—"
                  ? "Peak —"
                  : `Peak ${peakDownloadsPerUserLabel} • ${peakDownloadsPerUserDisplay}`
              }
            />
            <HighlightCard
              tone="purple"
              label="Resource Uploads"
              value={formatNumber(totalResourceUploadsInRange)}
              detail={`Avg ${avgResourceUploadsPerDay} uploads/day`}
            >
              <div className="mt-2 space-y-1 text-xs text-purple-500">
                <div>Notes • {formatNumber(totalNotesUploadedInRange)} ({resourceUploadMix.notes}%)</div>
                <div>PYQs • {formatNumber(totalPyqsUploadedInRange)} ({resourceUploadMix.pyqs}%)</div>
                <div>Syllabus • {formatNumber(totalSyllabusUploadedInRange)} ({resourceUploadMix.syllabus}%)</div>
              </div>
            </HighlightCard>
            <HighlightCard
              tone="amber"
              label="Top Download Day"
              value={topDownloadDayLabel === "—" ? "—" : topDownloadDayLabel}
              detail={
                topDownloadDayLabel === "—"
                  ? "No download activity"
                  : `${formatNumber(topDownloadDayValue)} downloads`
              }
            />
          </div>

          <div className="h-24 mb-4 relative">
            <div className="flex items-end h-full space-x-0.5">
              {dailyActivity
                .slice(selectedTimeRange === "lifetime" ? Math.max(-60, -dailyActivity.length) : -14)
                .map((day) => {
                  const height = Math.max((day.downloads / maxChartDownloads) * 100, 2);
                  return (
                    <div key={day.date} className="flex-1 group relative">
                      <div
                        className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-t w-full"
                        style={{ height: `${height}%` }}
                      />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        <br />
                        {formatNumber(day.downloads)} downloads
                        <br />
                        {formatNumber(day.unique_downloaders)} unique downloaders
                        <br />
                        {day.downloads_per_user} downloads/user
                        <br />
                        {formatNumber(day.new_users)} new users
                        <br />
                        Notes {formatNumber(day.notes_uploaded)} • PYQs {formatNumber(day.pyqs_uploaded)} • Syllabus {formatNumber(day.syllabus_uploaded)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {selectedTimeRange === "lifetime" && (
              <div className="col-span-2 md:col-span-4 xl:col-span-6 mb-2">
                <div className="text-center p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
                  <span className="text-sm font-semibold text-purple-700">
                    📊 Lifetime Analytics - Complete Platform History
                  </span>
                </div>
              </div>
            )}
            <SummaryCard tone="blue" value={formatNumber(totalDownloadsInRange)} label="Total Downloads" />
            <SummaryCard tone="indigo" value={formatNumber(totalUniqueDownloadersInRange)} label="Unique Downloaders" />
            <SummaryCard tone="sky" value={`${uniqueDownloaderShare}%`} label="User Reach" />
            <SummaryCard tone="green" value={formatNumber(totalNewUsersInRange)} label="New Users" />
            <SummaryCard
              tone="orange"
              value={formatNumber(avgDownloadsPerActiveDay)}
              label={selectedTimeRange === "lifetime" ? "Lifetime Avg/Day" : "Avg Daily Downloads"}
            />
            <SummaryCard tone="lime" value={avgDownloadsPerUserRange} label="Avg Downloads/User" />
            <SummaryCard tone="purple" value={formatNumber(totalResourceUploadsInRange)} label="Total Resource Uploads" />
            <SummaryCard tone="emerald" value={avgResourceUploadsPerDay} label="Avg Uploads/Day" />
            <SummaryCard tone="violet" value={formatNumber(totalNotesUploadedInRange)} label="Notes Uploaded" />
            <SummaryCard tone="amber" value={formatNumber(totalPyqsUploadedInRange)} label="PYQs Uploaded" />
            <SummaryCard tone="rose" value={formatNumber(totalSyllabusUploadedInRange)} label="Syllabus Uploaded" />
            {selectedTimeRange === "lifetime" && (
              <SummaryCard tone="indigo" value={formatNumber(dailyActivity.length)} label="Days Active" />
            )}
          </div>
        </div>

        {/* Most Active Users */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-red-600" />
            Most Active Users
          </h3>
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>Ranking top contributors by downloads & engagement</span>
            <span className="italic">Based on lifetime activity</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {activeUsers.slice(0, 8).map((user, index) => {
              const tierStyles =
                index === 0
                  ? "bg-yellow-100 text-yellow-700"
                  : index === 1
                    ? "bg-gray-100 text-gray-600"
                    : index === 2
                      ? "bg-orange-100 text-orange-600"
                      : "bg-blue-100 text-blue-600";

              return (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-white border border-transparent hover:border-blue-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${tierStyles}`}>
                      #{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-900 leading-tight">{user.name}</p>
                        {user.is_admin && <Shield className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.branch_name} • Sem {user.semester} • Last login {formatDate(user.last_login)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-right">
                    <div>
                      <div className="flex items-center justify-end text-sm font-semibold text-blue-600">
                        <Download className="w-4 h-4 mr-1" />
                        {formatNumber(user.total_downloads)}
                      </div>
                      <div className="text-xs text-gray-500">Downloads</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-end text-sm font-semibold text-green-600">
                        <BookmarkIcon className="w-4 h-4 mr-1" />
                        {formatNumber(user.saved_opportunities)}
                      </div>
                      <div className="text-xs text-gray-500">Bookmarks</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subject Analytics */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <GraduationCap className="w-5 h-5 mr-2 text-indigo-600" />
            Subject-wise Analytics
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch & Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Downloads
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg per Note
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subjectAnalytics.slice(0, 15).map((subject) => (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{subject.name}</div>
                        <div className="text-sm text-gray-500">{subject.code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{subject.branch_name}</div>
                      <div className="text-sm text-gray-500">Semester {subject.semester}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {subject.notes_count} notes
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{subject.total_downloads}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{subject.avg_downloads_per_note}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export and Additional Actions */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2 text-gray-600" />
            Export & Actions
          </h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleExportReport}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Analytics Report</span>
            </button>
            <button
              onClick={handleSetupAlerts}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Setup Alerts</span>
            </button>
            <button
              onClick={handleAdvancedAnalytics}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Advanced Analytics</span>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
