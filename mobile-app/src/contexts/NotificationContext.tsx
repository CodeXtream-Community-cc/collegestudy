import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getUnreadCount, loadUserNotifications, markNotificationAsRead, type Notification } from "../lib/notifications";

interface PopupNotification extends Notification {
  showAsPopup: boolean;
  timer?: NodeJS.Timeout;
}

interface NotificationContextType {
  unreadCount: number;
  popupNotifications: PopupNotification[];
  dismissPopup: (notificationId: string) => void;
  markAsReadAndDismiss: (notificationId: string) => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [popupNotifications, setPopupNotifications] = useState<PopupNotification[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isMounted = useRef(true);
  const lastCheckedAt = useRef<Date>(new Date());
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isMounted.current) {
        setCurrentUserId(user?.id || null);
      }
    };
    
    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted.current) {
        setCurrentUserId(session?.user?.id || null);
        if (event === "SIGNED_OUT") {
          setUnreadCount(0);
          setPopupNotifications([]);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Dismiss popup without marking as read
  const dismissPopup = useCallback((notificationId: string) => {
    setPopupNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification?.timer) {
        clearTimeout(notification.timer);
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  // Store the latest version of showNotificationPopup in a ref
  const showNotificationPopupRef = useRef((notification: Notification) => {
    setPopupNotifications(prev => {
      // Avoid duplicates
      if (prev.some(n => n.id === notification.id)) return prev;
      
      const popupNotification: PopupNotification = {
        ...notification,
        showAsPopup: true,
      };

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setPopupNotifications(current => current.filter(n => n.id !== notification.id));
        }
      }, 5000);

      return [...prev, { ...popupNotification, timer }];
    });
  });

  // Update the ref when the component re-renders
  useEffect(() => {
    showNotificationPopupRef.current = (notification: Notification) => {
      setPopupNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) return prev;
        
        const popupNotification: PopupNotification = {
          ...notification,
          showAsPopup: true,
        };

        const timer = setTimeout(() => {
          if (isMounted.current) {
            setPopupNotifications(current => current.filter(n => n.id !== notification.id));
          }
        }, 5000);

        return [...prev, { ...popupNotification, timer }];
      });
    };
  }, []);

  // Refresh unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!currentUserId || !isMounted.current) return;
    
    try {
      const count = await getUnreadCount(currentUserId);
      if (isMounted.current) {
        setUnreadCount(prevCount => prevCount !== count ? count : prevCount);
      }
    } catch (error) {
      console.error("Error refreshing unread count:", error);
    }
  }, [currentUserId]);

  // Check for new notifications
  const checkForNewNotifications = useCallback(async () => {
    if (!currentUserId || !isMounted.current) return;

    try {
      const notifications = await loadUserNotifications(currentUserId, 10);
      const newNotifications = notifications.filter(
        notification => !notification.is_read && new Date(notification.created_at) > lastCheckedAt.current
      );

      if (newNotifications.length > 0) {
        // Update last checked time first to prevent duplicate processing
        lastCheckedAt.current = new Date();
        
        // Process new notifications using the ref
        newNotifications.forEach(notification => {
          showNotificationPopupRef.current(notification);
        });
        
        // Only refresh unread count if we have new notifications
        await refreshUnreadCount();
      }
    } catch (error) {
      console.error("Error checking for new notifications:", error);
    }
  }, [currentUserId, refreshUnreadCount]);

  // Mark as read and dismiss
  const markAsReadAndDismiss = useCallback(async (notificationId: string) => {
    if (!currentUserId || !isMounted.current) return;

    try {
      const success = await markNotificationAsRead(notificationId, currentUserId);
      if (success) {
        // Optimistically update the UI
        setUnreadCount(prev => Math.max(0, prev - 1));
        dismissPopup(notificationId);
        
        // Then refresh the actual count
        await refreshUnreadCount();
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert optimistic update on error
      if (isMounted.current) {
        await refreshUnreadCount();
      }
    }
  }, [currentUserId, dismissPopup]);

  // Set up polling and real-time updates
  useEffect(() => {
    isMounted.current = true;
    
    if (!currentUserId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isSubscribed = true;
    
    const init = async () => {
      try {
        // Initial data load
        await refreshUnreadCount();
        
        // Only check for new notifications on initial load
        if (isInitialLoad.current && isSubscribed) {
          await checkForNewNotifications();
          isInitialLoad.current = false;
        }
        
        // Set up real-time subscription
        if (isSubscribed) {
          channel = supabase
            .channel('user_notifications')
            .on('postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'user_notifications',
                filter: `user_id=eq.${currentUserId}`,
              },
              () => {
                if (isMounted.current && isSubscribed) {
                  refreshUnreadCount();
                  checkForNewNotifications();
                }
              }
            )
            .subscribe();
        }
          
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };
    
    init();

    // Set up polling (every 30 seconds)
    const intervalId = setInterval(() => {
      if (isMounted.current && isSubscribed) {
        refreshUnreadCount();
      }
    }, 30000);
    
    refreshInterval.current = intervalId;

    // Cleanup function
    return () => {
      isMounted.current = false;
      isSubscribed = false;
      
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      
      if (channel) {
        channel.unsubscribe().catch(console.error);
      }
      
      // Clear any pending popup timeouts
      setPopupNotifications(prev => {
        prev.forEach(notification => {
          if (notification.timer) {
            clearTimeout(notification.timer);
          }
        });
        return [];
      });
    };
  }, [currentUserId, refreshUnreadCount, checkForNewNotifications]);

  const value: NotificationContextType = {
    unreadCount,
    popupNotifications,
    dismissPopup,
    markAsReadAndDismiss,
    refreshUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
