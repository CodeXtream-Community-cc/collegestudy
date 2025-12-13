import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useFocusEffect } from "expo-router";
import * as FileSystem from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl, 
  Linking, 
  Alert, 
  ActivityIndicator, 
  Image, 
  PermissionsAndroid, 
  Platform,
  Share
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { useNotifications } from "../../src/contexts/NotificationContext";
import { NotificationBadge } from "../../src/components/NotificationBadge";
import { CGPACalculator } from "../../src/components/CGPACalculator";
import { type Notification } from "../../src/lib/notifications";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  TrendingUp,
  Bell,
  ChevronRight,
  Clock,
  MapPin,
  Download,
  ExternalLink,
  User,
  Code,
  Target,
  Briefcase,
  Bot,
  Grid3X3,
} from "lucide-react-native";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  branch_id: string;
  year: number;
  semester: number;
  roll_number?: string;
  photo_url?: string;
  branches?: {
    name: string;
    code: string;
  };
}

interface Note {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type?: string;
  download_count?: number;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
  };
}

interface Event {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  event_type?: string;
  is_published?: boolean;
  organizer?: string;
}

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  subjects?: {
    name: string;
    code: string;
  };
}

interface ExamSchedule {
  id: string;
  exam_date: string;
  exam_type: string;
  subjects?: {
    name: string;
    code: string;
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Profile Refresh Context
const ProfileRefreshContext = createContext<{
  refreshProfile: () => Promise<void>;
  lastRefreshTime: number;
}>({
  refreshProfile: async () => {},
  lastRefreshTime: 0,
});

export const useProfileRefresh = () => useContext(ProfileRefreshContext);

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadsDirectoryUri, setDownloadsDirectoryUri] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<ExamSchedule[]>([]);
  const [stats, setStats] = useState({
    totalNotes: 0,
    upcomingEvents: 0,
    upcomingExams: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  // Refresh profile data when screen comes into focus (after editing profile)
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, refreshing profile data');
      loadData();
    }, [])
  );

  // Profile refresh function that can be called from anywhere in the app
  const refreshProfile = useCallback(async () => {
    console.log('Profile refresh triggered at:', new Date().toISOString());
    try {
      await loadData();
      setLastRefreshTime(Date.now());
      console.log('Profile refresh completed successfully');
    } catch (error) {
      console.error('Profile refresh failed:', error);
    }
  }, []);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/(auth)/welcome");
        return;
      }

      // Load user profile
      const { data: profileData } = await supabase
        .from("users")
        .select("*, branches(name, code)")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Load recent notes for user's branch and semester
        console.log('Fetching notes for branch:', profileData.branch_id, 'semester:', profileData.semester);
        
        try {
          // First, get the subject IDs for this branch and semester
          const { data: subjects, error: subjectsError } = await supabase
            .from('subjects')
            .select('id')
            .eq('branch_id', profileData.branch_id)
            .eq('semester', profileData.semester);

          if (subjectsError) throw subjectsError;
          
          const subjectIds = subjects?.map(s => s.id) || [];
          
          if (subjectIds.length === 0) {
            console.log('No subjects found for branch and semester');
            setRecentNotes([]);
          } else {
            // Then get notes for these subjects
            const { data: notesData, error: notesError } = await supabase
              .from('notes')
              .select(`
                *,
                subjects (
                  id,
                  name,
                  code
                )
              `)
              .in('subject_id', subjectIds)
              .eq('is_verified', true)
              .order('created_at', { ascending: false })
              .limit(3);

            if (notesError) throw notesError;
            
            console.log('Fetched notes:', notesData);
            setRecentNotes(notesData || []);
          }
        } catch (error) {
          console.error('Error in notes query:', error);
          setRecentNotes([]);
        }

        // Load today's classes
        const today = new Date().getDay();
        const { data: timetableData } = await supabase
          .from("timetable")
          .select("*, subjects(name, code)")
          .eq("branch_id", profileData.branch_id)
          .eq("semester", profileData.semester)
          .eq("day_of_week", today)
          .order("start_time");

        if (timetableData) {
          setTodayClasses(timetableData);
        }

        // Load upcoming events (only 1 for home page)
        const currentDate = new Date().toISOString().split("T")[0];
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .eq("is_published", true)
          .gte("event_date", currentDate)
          .order("event_date")
          .limit(2);

        if (eventsData) {
          setUpcomingEvents(eventsData);
        }

        // Load upcoming exams (only 1 for home page)
        const { data: examsData } = await supabase
          .from("exam_schedule")
          .select("*, subjects(name, code)")
          .eq("branch_id", profileData.branch_id)
          .eq("semester", profileData.semester)
          .gte("exam_date", currentDate)
          .order("exam_date")
          .limit(2);

        if (examsData) {
          setUpcomingExams(examsData);
        }

        // Load stats - Total notes count
        console.log('Fetching total notes count for branch:', profileData.branch_id, 'semester:', profileData.semester);
        
        try {
          // First get the subject IDs for this branch and semester
          const { data: subjects, error: subjectsError } = await supabase
            .from('subjects')
            .select('id')
            .eq('branch_id', profileData.branch_id)
            .eq('semester', profileData.semester);

          if (subjectsError) throw subjectsError;
          
          const subjectIds = subjects?.map(s => s.id) || [];
          let totalNotes = 0;
          
          if (subjectIds.length > 0) {
            // Then count notes for these subjects
            const { count, error: countError } = await supabase
              .from('notes')
              .select('*', { 
                count: 'exact', 
                head: true 
              })
              .in('subject_id', subjectIds)
              .eq('is_verified', true);
              
            if (countError) throw countError;
            totalNotes = count || 0;
          }
          
          console.log('Total notes count:', totalNotes);
          
          // Update the stats state
          setStats(prev => ({
            ...prev,
            totalNotes,
          }));
          
        } catch (error) {
          console.error('Error counting notes:', error);
          setStats(prev => ({
            ...prev,
            totalNotes: 0,
          }));
        }

        const { count: eventsCount } = await supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .gte("event_date", currentDate);

        const { count: examsCount } = await supabase
          .from("exam_schedule")
          .select("*", { count: "exact", head: true })
          .eq("branch_id", profileData.branch_id)
          .eq("semester", profileData.semester)
          .gte("exam_date", currentDate);

        // Get count of notes for the current user's branch and semester
        // First, get all subjects for the current branch and semester
        // Define interface for the query result
        interface SubjectBranch {
          subjects: {
            id: string;
            semester: number;
          };
        }

        const { data: subjectBranches } = await supabase
          .from('subject_branches')
          .select(`
            subjects!inner(
              id,
              semester
            )
          `)
          .eq('branch_id', profileData.branch_id)
          .eq('subjects.semester', profileData.semester) as { data: SubjectBranch[] | null };
          
        console.log(`Found ${subjectBranches?.length || 0} subject mappings for branch ${profileData.branch_id} and semester ${profileData.semester}`, subjectBranches);
        
        const subjectIds = subjectBranches?.map(sb => sb.subjects.id).filter(Boolean) || [];
        console.log('Subject IDs:', subjectIds);
        
        if (subjectIds.length === 0) {
          console.log('No subjects found for branch and semester');
          setStats({
            totalNotes: 0,
            upcomingEvents: eventsCount || 0,
            upcomingExams: examsCount || 0,
          });
          return;
        }
        
        // Get 2 most recent notes with subject information
        const notesQuery = supabase
          .from('notes')
          .select(`
            *,
            subjects (
              id,
              name,
              code
            )
          `, { count: 'exact' })
          .in('subject_id', subjectIds)
          .eq('is_verified', true)
          .order('created_at', { ascending: false })
          .limit(2); // Get only 2 most recent notes
          
        const { data: recentNotes, count: notesCount } = await notesQuery;
        
        console.log(`Found ${notesCount || 0} notes for ${subjectIds.length} subjects`);
        
        // Set recent notes for display
        if (recentNotes) {
          console.log('Recent notes:', recentNotes);
          setRecentNotes(recentNotes);
        } else {
          setRecentNotes([]);
        }

        setStats({
          totalNotes: notesCount || 0,
          upcomingEvents: eventsCount || 0,
          upcomingExams: examsCount || 0,
        });

        // Load notifications using helper functions
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    await refreshUnreadCount();
    // Refreshing will be set to false in loadData's finally block
  }

  function getDaysUntil(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function extractGoogleDriveId(url: string): string | null {
    const patterns = [/\/file\/d\/([^\/]+)/, /id=([^&]+)/, /\/d\/([^\/]+)/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'txt': 'text/plain',
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  async function ensureDownloadsAccess(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;

    const saf = FileSystem.StorageAccessFramework;
    if (!saf) {
      console.warn('StorageAccessFramework is unavailable on this platform');
      return null;
    }

    if (downloadsDirectoryUri) return downloadsDirectoryUri;

    try {
      Alert.alert(
        'Select Download Folder',
        'Please choose the folder where notes should be saved (recommended: Downloads).'
      );
      const permissions = await saf.requestDirectoryPermissionsAsync();
      if (!permissions.granted || !permissions.directoryUri) {
        Alert.alert('Permission required', 'Unable to save the file without folder access.');
        return null;
      }
      setDownloadsDirectoryUri(permissions.directoryUri);
      return permissions.directoryUri;
    } catch (error) {
      console.error('Directory permission error', error);
      Alert.alert('Permission error', 'Could not access the selected folder.');
    }

    return null;
  }

  function incrementLocalDownloadCount(noteId: string) {
    setRecentNotes((prevNotes) =>
      prevNotes.map((recentNote) =>
        recentNote.id === noteId
          ? {
              ...recentNote,
              download_count: (recentNote.download_count ?? 0) + 1,
            }
          : recentNote,
      ),
    );
  }

  async function downloadNote(note: Note) {
    try {
      setDownloading(note.id);
      const fileId = extractGoogleDriveId(note.file_url);
      if (!fileId) {
        const supported = await Linking.canOpenURL(note.file_url);
        if (supported) {
          await Linking.openURL(note.file_url);
        } else {
          Alert.alert("Error", "Could not open the file. The link might be invalid.");
        }
        return;
      }

      // Get file extension from URL or use a default
      let fileExtension = 'pdf';
      try {
        const url = new URL(note.file_url);
        const pathParts = url.pathname.split('.');
        if (pathParts.length > 1) {
          fileExtension = pathParts.pop()?.toLowerCase() || 'pdf';
        }
      } catch (e) {
        console.warn('Error parsing URL, using default extension', e);
      }

      const subjectPrefix = note.subjects?.code ? `${note.subjects.code.toLowerCase()}_` : '';
      const cleanTitle = note.title
        .replace(/[^\w\d\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();

      const fileName = `${subjectPrefix}${cleanTitle}.${fileExtension}`.toLowerCase();
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&force=true`;

      console.log('Starting download from:', downloadUrl);
      console.log('Saving temp to:', tempFileUri);

      try {
        const existing = await FileSystem.getInfoAsync(tempFileUri);
        if (existing.exists) {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        }
      } catch (cleanupError) {
        console.warn('Unable to clear temp file before download', cleanupError);
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        tempFileUri,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://drive.google.com/',
          },
        },
        (progress) => {
          const pct = progress.totalBytesExpectedToWrite
            ? (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
            : 0;
          console.log(`Download progress: ${pct}%`);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Download failed: No result returned');
      }

      const downloadedUri = result.uri;
      const mimeType = getMimeType(fileExtension);
      let savedContentUri: string | null = null;
      let savedToDevice = false;
      let savedLocationDescription = '';

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const directoryUri = await ensureDownloadsAccess();
        if (directoryUri) {
          try {
            const saf = FileSystem.StorageAccessFramework;
            const base64 = await FileSystem.readAsStringAsync(downloadedUri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            let destinationUri: string | null = null;
            try {
              destinationUri = await saf.createFileAsync(directoryUri, fileName, mimeType);
            } catch (createError) {
              console.warn('Primary file creation failed, generating fallback name', createError);
              const nameWithoutExt = fileName.replace(new RegExp(`\\.${fileExtension}$`), '');
              const fallbackName = `${nameWithoutExt}-${Date.now()}.${fileExtension}`;
              destinationUri = await saf.createFileAsync(directoryUri, fallbackName, mimeType);
            }

            if (destinationUri) {
              await FileSystem.writeAsStringAsync(destinationUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              savedContentUri = destinationUri;
              savedToDevice = true;
              savedLocationDescription = 'your selected folder';
            }
          } catch (safError) {
            console.error('Saving to selected folder failed', safError);
            Alert.alert('Storage error', 'Could not save to the selected folder. We will attempt the default Downloads folder instead.');
          }
        }
      }

      if (!savedToDevice && Platform.OS === 'android') {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.status === 'granted') {
          try {
            const asset = await MediaLibrary.createAssetAsync(downloadedUri);
            const album = await MediaLibrary.getAlbumAsync('Download');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
              await MediaLibrary.createAlbumAsync('Download', asset, false);
            }
            savedContentUri = asset.uri ?? null;
            savedToDevice = true;
            savedLocationDescription = 'the Downloads folder';
          } catch (mediaError) {
            console.error('MediaLibrary save failed', mediaError);
          }
        }
      }

      if (savedToDevice) {
        Alert.alert('Saved', `File saved to ${savedLocationDescription}.`);
      } else {
        Alert.alert('Success', 'File downloaded successfully!');
      }

      try {
        if (Platform.OS === 'android') {
          const uriToOpen = savedContentUri || await FileSystem.getContentUriAsync(downloadedUri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: uriToOpen,
            flags: 1,
            type: mimeType,
          });
        } else {
          await Share.share({
            url: `file://${downloadedUri}`,
            title: `Open ${fileName}`,
          });
        }
      } catch (openError) {
        console.warn('Error opening file:', openError);
        Alert.alert('Download Complete', savedToDevice ? 'Saved to your device.' : `File saved to: ${downloadedUri}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      let incremented = false;

      if (user) {
        try {
          await supabase.rpc('track_note_download', {
            p_note_id: note.id,
            p_user_id: user.id,
            p_ip_address: null,
            p_user_agent: 'College Study Mobile App',
            p_file_size: null,
          });
          incremented = true;
        } catch (trackError) {
          console.warn('track_note_download failed, falling back to increment_download_count', trackError);
        }
      }

      if (!incremented) {
        try {
          await supabase.rpc('increment_download_count', { note_id: note.id });
          incremented = true;
        } catch (incrementError) {
          console.error('Failed to increment download count directly', incrementError);
        }
      }

      if (incremented) {
        incrementLocalDownloadCount(note.id);
      }
    } catch (error) {
      console.error('Download failed:', error);
      const fileId = extractGoogleDriveId(note.file_url);
      if (fileId) {
        const webViewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
        const supported = await Linking.canOpenURL(webViewUrl);
        if (supported) {
          await Linking.openURL(webViewUrl);
        } else {
          Alert.alert(
            'Download Error',
            error instanceof Error ? error.message : 'Could not download the file. Please try again later.',
          );
        }
      } else {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to download the file. Please try again.',
        );
      }
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ProfileRefreshContext.Provider value={{ refreshProfile, lastRefreshTime }}>
      <View style={[{ flex: 1, backgroundColor: "#ffffff" }]}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0066cc"]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.profilePhotoContainer} onPress={() => router.push("/(tabs)/profile")}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <User color="#0066cc" size={20} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>Hello, {profile?.name?.split(" ")[0] || "Student"}! 👋</Text>
              <Text style={styles.subGreeting}>
                {profile?.branches?.name} • Semester {profile?.semester}
              </Text>
            </View>
          </View>
          <View style={styles.notificationContainer}>
            <NotificationBadge onPress={() => router.push("/notifications")} size="large" />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#e6f7ff" }]}>
              <BookOpen color="#0066cc" size={24} />
            </View>
            <Text style={styles.statValue}>{stats.totalNotes}</Text>
            <Text style={styles.statLabel}>Total Notes</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#f6ffed" }]}>
              <Calendar color="#52c41a" size={24} />
            </View>
            <Text style={styles.statValue}>{stats.upcomingEvents}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#fff7e6" }]}>
              <GraduationCap color="#fa8c16" size={24} />
            </View>
            <Text style={styles.statValue}>{stats.upcomingExams}</Text>
            <Text style={styles.statLabel}>Exams</Text>
          </View>
        </View>

        {/* Today's Classes */}
        {todayClasses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Classes</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/timetable")}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {todayClasses.map((classItem) => (
              <View key={classItem.id} style={styles.classCard}>
                <View style={styles.classTimeContainer}>
                  <Text style={styles.classTime}>{classItem.start_time.slice(0, 5)}</Text>
                  <Text style={styles.classTimeTo}>to</Text>
                  <Text style={styles.classTime}>{classItem.end_time.slice(0, 5)}</Text>
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.classTitle}>{classItem.subjects?.name}</Text>
                  <Text style={styles.classCode}>{classItem.subjects?.code}</Text>
                  {classItem.room_number && (
                    <View style={styles.classLocation}>
                      <MapPin color="#666" size={14} />
                      <Text style={styles.classLocationText}>{classItem.room_number}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Unread Messages Indicator */}
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.unreadIndicator} onPress={() => router.push("/notifications")}>
            <View style={styles.unreadContent}>
              <Bell color="#3B82F6" size={24} />
              <View style={styles.unreadTextContainer}>
                <Text style={styles.unreadTitle}>You have unread messages</Text>
                <Text style={styles.unreadSubtitle}>
                  {unreadCount} unread notification{unreadCount > 1 ? "s" : ""} • Tap to view
                </Text>
              </View>
              <ChevronRight color="#3B82F6" size={20} />
            </View>
          </TouchableOpacity>
        )}

        {/* Next Upcoming Exam */}
        {upcomingExams.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Exams</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/timetable")}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {upcomingExams.map((exam) => {
              const daysUntil = getDaysUntil(exam.exam_date);
              return (
                <View key={exam.id} style={styles.examCard}>
                  <View
                    style={[
                      styles.examDateBadge,
                      daysUntil <= 3 && { backgroundColor: "#fff1f0", borderColor: "#ff4d4f" },
                    ]}
                  >
                    <Text style={[styles.examDays, daysUntil <= 3 && { color: "#ff4d4f" }]}>
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                    </Text>
                  </View>
                  <View style={styles.examInfo}>
                    <Text style={styles.examTitle}>{exam.subjects?.name}</Text>
                    <Text style={styles.examType}>{exam.exam_type}</Text>
                    <Text style={styles.examDate}>{new Date(exam.exam_date).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BookOpen color="#0066cc" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Recent Notes</Text>
            </View>
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => router.push("/(tabs)/notes")}
            >
              <Text style={styles.seeAllText}>View All</Text>
              <ChevronRight size={16} color="#0066cc" />
            </TouchableOpacity>
          </View>

          {recentNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen color="#e6f7ff" size={48} />
              <Text style={styles.emptyStateText}>No recent notes</Text>
              <Text style={[styles.emptyStateText, { fontSize: 14, color: '#999' }]}>
                New notes will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.notesGrid}>
              {recentNotes.map((note) => (
                <TouchableOpacity 
                  key={note.id} 
                  style={styles.noteCard} 
                  onPress={() => downloadNote(note)}
                >
                  
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={styles.noteSubject} numberOfLines={1}>
                        {note.subjects?.name} ({note.subjects?.code})
                      </Text>
                      <Text style={[styles.noteDate, { marginLeft: 8 }]}>
                        • {new Date(note.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {downloading === note.id ? (
                    <ActivityIndicator size="small" color="#0066cc" />
                  ) : (
                    <Download color="#0066cc" size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Next Upcoming Event */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Next Upcoming Event</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/events")}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.eventCard} onPress={() => router.push(`/event/${upcomingEvents[0].id}`)}>
              <View style={styles.eventDateBox}>
                <Text style={styles.eventDay}>{new Date(upcomingEvents[0].event_date).getDate()}</Text>
                <Text style={styles.eventMonth}>
                  {new Date(upcomingEvents[0].event_date).toLocaleDateString("en-US", { month: "short" })}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {upcomingEvents[0].title}
                </Text>
                {upcomingEvents[0].description && (
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    {upcomingEvents[0].description}
                  </Text>
                )}
                {upcomingEvents[0].start_time && (
                  <View style={styles.eventTimeRow}>
                    <Clock color="#666" size={14} />
                    <Text style={styles.eventTime}>{upcomingEvents[0].start_time}</Text>
                  </View>
                )}
                {upcomingEvents[0].location && (
                  <View style={styles.eventLocation}>
                    <MapPin color="#666" size={14} />
                    <Text style={styles.eventLocationText}>{upcomingEvents[0].location}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Section Break */}
        <View style={styles.sectionBreak}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Academic Tools</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* CGPA Calculator - Enhanced Section */}
        {profile && (
          <View style={styles.cgpaSection}>
            <View style={styles.cgpaSectionHeader}>
              <Text style={styles.cgpaSectionTitle}>CGPA Calculator</Text>
              <Text style={styles.cgpaSectionSubtitle}>
                Track your academic performance with our smart CGPA calculator
              </Text>
            </View>
            <CGPACalculator 
              userId={profile.id} 
              userSemester={profile.semester}
              userYear={profile.year}
              userBranchId={profile.branch_id}
            />
          </View>
        )}

        {/* Common Learning Resources */}
        <View style={styles.commonResourcesSection}>
          <View style={styles.commonSectionHeader}>
            <Text style={styles.commonSectionTitle}>Common Learning Resources</Text>
            <Text style={styles.commonSectionSubtitle}>Essential resources for every computer science student</Text>
          </View>

          <View style={styles.resourcesGrid}>
            <TouchableOpacity style={styles.resourceCard} onPress={() => router.push("/common/dsa")}>
              <View style={[styles.resourceIcon, { backgroundColor: "#e6f4ff" }]}>
                <Code color="#1890ff" size={24} />
              </View>
              <Text style={styles.resourceTitle}>DSA Notes</Text>
              <Text style={styles.resourceDescription}>Data Structures & Algorithms</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resourceCard} onPress={() => router.push("/common/development")}>
              <View style={[styles.resourceIcon, { backgroundColor: "#f6ffed" }]}>
                <Grid3X3 color="#52c41a" size={24} />
              </View>
              <Text style={styles.resourceTitle}>Development</Text>
              <Text style={styles.resourceDescription}>Web, Mobile & Backend</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resourceCard} onPress={() => router.push("/common/placement")}>
              <View style={[styles.resourceIcon, { backgroundColor: "#fff2e6" }]}>
                <Target color="#fa8c16" size={24} />
              </View>
              <Text style={styles.resourceTitle}>Placement Prep</Text>
              <Text style={styles.resourceDescription}>Interview & Resume Tips</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resourceCard} onPress={() => router.push("/common/ai-tools")}>
              <View style={[styles.resourceIcon, { backgroundColor: "#f9f0ff" }]}>
                <Bot color="#722ed1" size={24} />
              </View>
              <Text style={styles.resourceTitle}>AI Tools</Text>
              <Text style={styles.resourceDescription}>Productivity & Learning AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacing before credits */}
        <View style={styles.creditsSpacing} />

        {/* Credits Section */}
        <View style={styles.creditsSection}>
          <Text style={styles.quote}>
            “What is most important is to look ahead, to the future, to think of the next generation.”
          </Text>
          <Text style={styles.quoteAuthor}>- APJ Abdul Kalam</Text>

          <View style={styles.madeWithLove}>
            <Text style={styles.madeWithText}>Made with ❤️ for students</Text>
          </View>

          <View style={styles.foundersSection}>
            <Text style={styles.teamTitle}>The Team Behind Your Success 🚀</Text>
            <View style={styles.foundersGrid}>
              <View style={styles.founderCard}>
                <Text style={styles.founderName}>Priyal Kumar Singh</Text>
                <Text style={styles.founderRole}>Founder</Text>
              </View>
              <View style={styles.founderCard}>
                <Text style={styles.founderName}>Ravi Pratap Singh</Text>
                <Text style={styles.founderRole}>Co-founder</Text>
              </View>
            </View>
            <Text style={styles.companyBrand}>College Study</Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
    </ProfileRefreshContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  subGreeting: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profilePhotoContainer: {
    marginRight: 12,
  },
  profilePhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
  },
  profilePhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e6f7ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#bfdbfe",
  },
  greetingContainer: {
    flex: 1,
    marginRight: 16,
  },
  notificationContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
  },

  unreadBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  viewAllButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e6f4ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  notesGrid: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  seeAllText: {
    fontSize: 14,
    color: "#0066cc",
    fontWeight: "600",
  },
  classCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  classTimeContainer: {
    alignItems: "center",
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 2,
    borderRightColor: "#0066cc",
  },
  classTime: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0066cc",
  },
  classTimeTo: {
    fontSize: 10,
    color: "#999",
    marginVertical: 4,
  },
  classInfo: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  classCode: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  classLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  classLocationText: {
    fontSize: 12,
    color: "#666",
  },
  examCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  examDateBadge: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#fff7e6",
    borderWidth: 2,
    borderColor: "#ffa940",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  examDays: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fa8c16",
  },
  examInfo: {
    flex: 1,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  examType: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  examDate: {
    fontSize: 12,
    color: "#999",
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e6f4ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  noteSubject: {
    fontSize: 12,
    color: "#0066cc",
    marginBottom: 2,
  },
  noteDate: {
    fontSize: 11,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  eventDateBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f0f5ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  eventDay: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0066cc",
  },
  eventMonth: {
    fontSize: 12,
    color: "#0066cc",
    textTransform: "uppercase",
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  eventDescription: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  eventTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  eventTime: {
    fontSize: 12,
    color: "#666",
  },
  eventLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventLocationText: {
    fontSize: 12,
    color: "#666",
  },
  bottomSpacing: {
    height: 20,
  },
  unreadIndicator: {
    backgroundColor: "#EBF8FF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  unreadTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 2,
  },
  unreadSubtitle: {
    fontSize: 13,
    color: "#3B82F6",
  },
  sectionBreak: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
    marginHorizontal: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    paddingHorizontal: 16,
    backgroundColor: "#f8f9fa",
  },
  cgpaSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
    borderColor: "#e6f3ff",
    shadowColor: "#0066cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cgpaSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cgpaSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0066cc",
    marginBottom: 4,
  },
  cgpaSectionSubtitle: {
    fontSize: 14,
    color: "#4a90e2",
    fontStyle: "italic",
  },
  commonResourcesSection: {
    marginHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e8ecf0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  commonSectionHeader: {
    marginBottom: 20,
    alignItems: "center",
  },
  commonSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
  },
  commonSectionSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  resourcesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  resourceCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  resourceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
  creditsSpacing: {
    height: 48,
  },
  creditsSection: {
    marginHorizontal: 16,
    backgroundColor: "#fafbfc",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e8ecf0",
    shadowColor: "#0066cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  quote: {
    fontSize: 17,
    fontStyle: "italic",
    color: "#444",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 8,
    fontWeight: "400",
  },
  quoteAuthor: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  madeWithLove: {
    alignItems: "center",
    marginBottom: 20,
  },
  madeWithText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0066cc",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  foundersSection: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 20,
  },
  teamTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  foundersGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 16,
  },
  founderCard: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  founderName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0066cc",
    textAlign: "center",
    marginBottom: 2,
  },
  founderRole: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  companyBrand: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0066cc",
    textAlign: "center",
    letterSpacing: 1,
  },
});
