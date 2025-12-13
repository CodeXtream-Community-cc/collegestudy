import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { setStatusBarStyle } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationOverlay } from "../src/components/NotificationOverlay";
import { CleanupService } from "../src/lib/cleanupService";
import ErrorBoundary from '../src/components/ErrorBoundary';
import setupGlobalErrorHandling from '../src/utils/errorHandler';

setupGlobalErrorHandling();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const statusBarStyle = isDarkMode ? "light" : "dark";
  const statusBarBackground = isDarkMode ? "#000000" : "#ffffff";

  useEffect(() => {
    // Explicitly set status bar style on mount
    if (Platform.OS === "ios") {
      setStatusBarStyle(statusBarStyle);
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);

      // Perform cleanup when user signs in
      if (event === "SIGNED_IN") {
        CleanupService.performStartupCleanup();
      }
    });

    // Perform initial cleanup on app startup
    CleanupService.performStartupCleanup();

    return () => {
      subscription.unsubscribe();
    };
  }, [statusBarStyle]);

  return (
    <>
    <ErrorBoundary>
      <StatusBar style={statusBarStyle} backgroundColor={statusBarBackground} translucent={false} />
      <SafeAreaView style={{ flex: 1, backgroundColor: statusBarBackground }}>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <NotificationOverlay />
        </NotificationProvider>
      </SafeAreaView>
      </ErrorBoundary>
    </>
  );
}
