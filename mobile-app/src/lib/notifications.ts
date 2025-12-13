import { supabase } from "./supabase";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: any;
}

export async function loadUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from("user_notifications")
      .select(
        `
        id,
        is_read,
        read_at,
        created_at,
        notifications!inner (
          id,
          title,
          message,
          type,
          priority,
          created_at,
          expires_at,
          is_published,
          metadata
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error loading notifications:", error);
      return [];
    }

    // Filter and transform the data
    const now = new Date();
    return (data || [])
      .filter((item: any) => {
        const notification = item.notifications;
        // Only show published notifications that haven't expired
        if (!notification.is_published) return false;
        if (notification.expires_at && new Date(notification.expires_at) <= now) return false;
        return true;
      })
      .map((item: any) => ({
        id: item.notifications.id,
        title: item.notifications.title,
        message: item.notifications.message,
        type: item.notifications.type,
        priority: item.notifications.priority,
        is_read: item.is_read,
        read_at: item.read_at,
        created_at: item.notifications.created_at,
        metadata: item.notifications.metadata,
      }));
  } catch (error) {
    console.error("Error in loadUserNotifications:", error);
    return [];
  }
}

// Simple implementation without retries or timeouts
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) {
    console.warn('getUnreadCount called without userId');
    return 0;
  }

  try {
    console.log('Fetching unread count for user:', userId);
    
    // Check Supabase connection
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error in getUnreadCount:', sessionError);
      return 0;
    }
    
    if (!sessionData?.session) {
      console.warn('No active session when fetching unread count');
      return 0;
    }

    const { data, error } = await supabase
      .from("user_notifications")
      .select(`
        id,
        notifications!inner ( 
          expires_at,
          is_published
        )
      `)
      .eq("user_id", userId)
      .eq("is_read", false)
      .limit(100);

    if (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }

    if (!data) {
      console.log('No unread notifications found for user:', userId);
      return 0;
    }

    // Filter out expired and unpublished notifications
    const now = new Date();
    const validNotifications = data.filter((item: any) => {
      const notification = item.notifications;
      if (!notification?.is_published) return false;
      if (notification.expires_at && new Date(notification.expires_at) <= now) return false;
      return true;
    });

    const count = validNotifications.length;
    console.log(`Found ${count} valid unread notifications`);
    return count;
    
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("notification_id", notificationId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: string, notificationIds: string[]): Promise<boolean> {
  try {
    if (notificationIds.length === 0) return true;

    const { error } = await supabase
      .from("user_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .in("notification_id", notificationIds);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    return false;
  }
}

export function getNotificationIcon(type: string): string {
  switch (type) {
    case "exam_reminder":
      return "📚";
    case "event":
      return "🎉";
    case "opportunity":
      return "💼";
    case "timetable_update":
      return "📅";
    case "announcement":
      return "📢";
    case "custom":
      return "📬";
    default:
      return "📬";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "#EF4444";
    case "high":
      return "#F59E0B";
    case "normal":
      return "#3B82F6";
    case "low":
      return "#6B7280";
    default:
      return "#3B82F6";
  }
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return "Just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  } else if (diffInMinutes < 10080) {
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
