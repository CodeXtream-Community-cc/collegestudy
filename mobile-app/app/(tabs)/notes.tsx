import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  Platform,
  Share,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { BookOpen, Download, Search, ChevronDown, ChevronRight, FileText } from "lucide-react-native";
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

interface UserProfile {
  branch_id: string;
  semester: number;
  year: number;
  branches?:
  | {
    name: string;
    code: string;
  }
  | {
    name: string;
    code: string;
  }[];
}

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const MATERIAL_CATEGORIES = [
  { value: "notes", label: "Notes" },
  { value: "books", label: "Books" },
  { value: "practicals", label: "Practical Files" },
  { value: "assignments", label: "Assignments" },
  { value: "other", label: "Other Material" },
] as const;

type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]["value"];

interface Note {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type?: string;
  is_verified: boolean;
  download_count: number;
  material_category?: MaterialCategory | null;
  created_at?: string;
  tags?: string[] | null;
}

type NotesByCategory = {
  [key in MaterialCategory]: Note[];
};

interface SubjectWithNotes extends Subject {
  notes: NotesByCategory;
  expanded: boolean;
  expandedCategories: {
    [key in MaterialCategory]: boolean;
  };
}

interface PyqDocument {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type?: string;
  is_verified: boolean;
  download_count: number;
  semester: number;
  tags?: string[] | null;
  created_at?: string;
}

interface SyllabusDocument {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type?: string;
  is_verified: boolean;
  download_count: number;
  semester: number;
  tags?: string[] | null;
  created_at?: string;
}

function createEmptyNotesByCategory(): NotesByCategory {
  return MATERIAL_CATEGORIES.reduce((acc, category) => {
    acc[category.value] = [];
    return acc;
  }, {} as NotesByCategory);
}

function createDefaultExpandedCategories(): Record<MaterialCategory, boolean> {
  return MATERIAL_CATEGORIES.reduce((acc, category) => {
    acc[category.value] = false;
    return acc;
  }, {} as Record<MaterialCategory, boolean>);
}

function resolveBranchCode(branches: UserProfile["branches"] | null | undefined): string | undefined {
  if (!branches) return undefined;
  if (Array.isArray(branches)) {
    return branches[0]?.code;
  }
  return branches.code;
}

function noteMatchesQuery(note: Note, query: string): boolean {
  return [note.title, note.description, ...(note.tags ?? [])]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(query));
}

function pyqMatchesQuery(pyq: PyqDocument, query: string): boolean {
  return [pyq.title, pyq.description, ...(pyq.tags ?? []), `semester ${pyq.semester}`]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(query));
}

function syllabusMatchesQuery(syllabus: SyllabusDocument, query: string): boolean {
  return [syllabus.title, syllabus.description, ...(syllabus.tags ?? []), `semester ${syllabus.semester}`]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(query));
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

export default function Notes() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithNotes[]>([]);
  const [pyqDocuments, setPyqDocuments] = useState<PyqDocument[]>([]);
  const [pyqExpanded, setPyqExpanded] = useState<boolean>(false);
  const [syllabusDocuments, setSyllabusDocuments] = useState<SyllabusDocument[]>([]);
  const [syllabusExpanded, setSyllabusExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadsDirectoryUri, setDownloadsDirectoryUri] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load user profile
      const { data: profileData } = await supabase
        .from("users")
        .select("branch_id, semester, year, branches(name, code)")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          ...profileData,
        } as UserProfile);

        // Subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from("subject_branches")
          .select(`
            subjects!inner (
              id,
              name,
              code,
              semester,
              is_active
            )
          `)
          .eq("branch_id", profileData.branch_id)
          .eq("subjects.semester", profileData.semester)
          .eq("subjects.is_active", true)
          .order("name", { foreignTable: "subjects" });

        if (subjectsError) throw subjectsError;

        const extractedSubjects = (subjectsData || [])
          .flatMap(item => {
            const subjs = Array.isArray(item.subjects) ? item.subjects : [item.subjects];
            return subjs
              .filter((subject): subject is Subject => subject && typeof subject === 'object' && 'id' in subject)
              .map(subject => ({
                id: subject.id,
                name: subject.name,
                code: subject.code,
                semester: subject.semester,
                is_active: subject.is_active
              }));
          })
          .filter((subject, index, self) =>
            index === self.findIndex(s => s.id === subject.id)
          );

        let notesBySubject: SubjectWithNotes[] = [];
        if (extractedSubjects.length > 0) {
          notesBySubject = await Promise.all(
            extractedSubjects.map(async (subject) => {
              const { data: notesData } = await supabase
                .from("notes")
                .select("*")
                .eq("subject_id", subject.id)
                .eq("is_verified", true)
                .order("created_at", { ascending: false });

              const categorized = createEmptyNotesByCategory();

              if (notesData) {
                (notesData as Note[]).forEach((note) => {
                  const category = note.material_category as MaterialCategory | null;
                  if (category && categorized[category]) {
                    categorized[category].push(note);
                  }
                });
              }

              return {
                ...subject,
                notes: categorized,
                expanded: false,
                expandedCategories: createDefaultExpandedCategories(),
              } as SubjectWithNotes;
            }),
          );
        }

        const { data: pyqRows, error: pyqError } = await supabase
          .from("pyq_documents")
          .select(
            `
              *,
              pyq_document_branches!inner (
                branch_id
              )
            `,
          )
          .eq("pyq_document_branches.branch_id", profileData.branch_id)
          .eq("semester", profileData.semester)
          .order("created_at", { ascending: false });

        if (pyqError) throw pyqError;

        const uniquePyqsMap = new Map<string, PyqDocument>();
        (pyqRows as any[] | null)?.forEach((row) => {
          const doc = row as PyqDocument;
          if (!uniquePyqsMap.has(doc.id)) {
            uniquePyqsMap.set(doc.id, doc);
          }
        });

        const pyqDocs = Array.from(uniquePyqsMap.values())
          .filter((doc) => doc.is_verified !== false)
          .sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
          });

        const { data: syllabusRows, error: syllabusError } = await supabase
          .from("syllabus_documents")
          .select(
            `
              *,
              syllabus_document_branches!inner (
                branch_id
              )
            `,
          )
          .eq("syllabus_document_branches.branch_id", profileData.branch_id)
          .eq("semester", profileData.semester)
          .order("created_at", { ascending: false });

        if (syllabusError) throw syllabusError;

        const uniqueSyllabusMap = new Map<string, SyllabusDocument>();
        (syllabusRows as any[] | null)?.forEach((row) => {
          const doc = row as SyllabusDocument;
          if (!uniqueSyllabusMap.has(doc.id)) {
            uniqueSyllabusMap.set(doc.id, doc);
          }
        });

        const syllabusDocs = Array.from(uniqueSyllabusMap.values())
          .filter((doc) => doc.is_verified !== false)
          .sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
          });

        setSubjects(notesBySubject);
        setPyqDocuments(pyqDocs);
        setPyqExpanded(false);
        setSyllabusDocuments(syllabusDocs);
        setSyllabusExpanded(false);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Error", "Failed to load subjects. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function downloadPyq(pyq: PyqDocument) {
    let downloadedFilePath: string | null = null;
    try {
      setDownloading(pyq.id);

      const branchCode = resolveBranchCode(profile?.branches) || "pyq";
      const semesterPrefix = `sem${pyq.semester}_`;
      const cleanTitle = pyq.title.replace(/[^\w\d\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();

      let fileExtension = 'pdf';
      try {
        const url = new URL(pyq.file_url);
        const pathParts = url.pathname.split('.');
        if (pathParts.length > 1) fileExtension = pathParts.pop()?.toLowerCase() || 'pdf';
      } catch {
        // default to pdf when we cannot parse the url
      }

      const fileName = `${branchCode}_${semesterPrefix}${cleanTitle}.${fileExtension}`.toLowerCase();
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const fileId = extractGoogleDriveId(pyq.file_url);
      if (!fileId) {
        const supported = await Linking.canOpenURL(pyq.file_url);
        if (supported) {
          await Linking.openURL(pyq.file_url);
        } else {
          Alert.alert("Error", "Could not open the file. The link might be invalid.");
        }
        return;
      }

      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&force=true`;

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
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Download failed: No result returned');
      }

      downloadedFilePath = result.uri;
      const mimeType = getMimeType(fileExtension);

      const saveOutcome = await persistDownloadedFile(downloadedFilePath, fileName, mimeType);

      if (saveOutcome.status === 'saved') {
        Alert.alert('Saved', `File saved to ${saveOutcome.description ?? 'your device'}.`);
      } else if (saveOutcome.status === 'shared') {
        Alert.alert('Saved', 'The file is ready to share. Choose a destination in the share sheet.');
      } else if (saveOutcome.status === 'cancelled') {
        Alert.alert('Download cancelled', 'The file was not saved.');
        return;
      } else {
        Alert.alert('Save failed', 'Could not save the file. Please try again.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Unable to record download',
          'Please sign in again and retry downloading this document.',
        );
        return;
      }

      let recorded = false;

      try {
        await supabase.rpc('track_pyq_download', {
          p_pyq_id: pyq.id,
          p_user_id: user.id,
          p_ip_address: null,
          p_user_agent: 'College Study Mobile App',
          p_file_size: null,
        });
        recorded = true;
      } catch (trackingError) {
        console.error('track_pyq_download failed', trackingError);
      }

      if (!recorded) {
        try {
          await supabase.rpc('increment_pyq_download_count', { p_pyq_id: pyq.id });
          recorded = true;
        } catch (incrementError) {
          console.error('increment_pyq_download_count failed', incrementError);
        }
      }

      if (!recorded) {
        Alert.alert(
          'Download not recorded',
          'We could not record this download. Please try again later.',
        );
        return;
      }

      let latestPyqCount: number | undefined;
      try {
        const { data } = await supabase
          .from('pyq_documents')
          .select('download_count')
          .eq('id', pyq.id)
          .single();
        latestPyqCount = data?.download_count ?? undefined;
      } catch (countError) {
        console.error('Failed to fetch updated PYQ download count', countError);
      }

      updateLocalPyqDownloadCount(pyq.id, latestPyqCount);
      
      // Refresh data to show updated download counts
      loadData();
    } catch (error) {
      console.error('Download failed:', error);
      const fileId = extractGoogleDriveId(pyq.file_url);

      if (fileId) {
        const webViewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
        const supported = await Linking.canOpenURL(webViewUrl);
        if (supported) {
          await Linking.openURL(webViewUrl);
        } else {
          Alert.alert(
            'Download Error',
            error instanceof Error ? error.message : 'Could not download the file. Please try again later.'
          );
        }
      } else {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to download the file. Please try again."
        );
      }
    } finally {
      setDownloading(null);
      try {
        if (downloadedFilePath) {
          await FileSystem.deleteAsync(downloadedFilePath, { idempotent: true });
        }
      } catch (cleanupError) {
        console.warn('Unable to clear temporary download', cleanupError);
      }
    }
  }

  async function downloadSyllabus(doc: SyllabusDocument) {
    let downloadedFilePath: string | null = null;
    try {
      setDownloading(doc.id);

      const branchCode = resolveBranchCode(profile?.branches) || "syllabus";
      const semesterPrefix = `sem${doc.semester}_`;
      const cleanTitle = doc.title.replace(/[^\w\d\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();

      let fileExtension = 'pdf';
      try {
        const url = new URL(doc.file_url);
        const pathParts = url.pathname.split('.');
        if (pathParts.length > 1) fileExtension = pathParts.pop()?.toLowerCase() || 'pdf';
      } catch {
        // default to pdf when we cannot parse the url
      }

      const fileName = `${branchCode}_${semesterPrefix}${cleanTitle}.${fileExtension}`.toLowerCase();
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const fileId = extractGoogleDriveId(doc.file_url);
      if (!fileId) {
        const supported = await Linking.canOpenURL(doc.file_url);
        if (supported) {
          await Linking.openURL(doc.file_url);
        } else {
          Alert.alert("Error", "Could not open the file. The link might be invalid.");
        }
        return;
      }

      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&force=true`;

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
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Download failed: No result returned');
      }

      downloadedFilePath = result.uri;
      const mimeType = getMimeType(fileExtension);

      const saveOutcome = await persistDownloadedFile(downloadedFilePath, fileName, mimeType);

      if (saveOutcome.status === 'saved') {
        Alert.alert('Saved', `File saved to ${saveOutcome.description ?? 'your device'}.`);
      } else if (saveOutcome.status === 'shared') {
        Alert.alert('Saved', 'The file is ready to share. Choose a destination in the share sheet.');
      } else if (saveOutcome.status === 'cancelled') {
        Alert.alert('Download cancelled', 'The file was not saved.');
        return;
      } else {
        Alert.alert('Save failed', 'Could not save the file. Please try again.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Unable to record download',
          'Please sign in again and retry downloading this syllabus.',
        );
        return;
      }

      let recorded = false;

      try {
        await supabase.rpc('track_syllabus_download', {
          p_syllabus_id: doc.id,
          p_user_id: user.id,
          p_ip_address: null,
          p_user_agent: 'College Study Mobile App',
          p_file_size: null,
        });
        recorded = true;
      } catch (trackingError) {
        console.error('track_syllabus_download failed', trackingError);
      }

      if (!recorded) {
        try {
          await supabase.rpc('increment_syllabus_download_count', { p_syllabus_id: doc.id });
          recorded = true;
        } catch (incrementError) {
          console.error('increment_syllabus_download_count failed', incrementError);
        }
      }

      if (!recorded) {
        Alert.alert(
          'Download not recorded',
          'We could not record this download. Please try again later.',
        );
        return;
      }

      let latestSyllabusCount: number | undefined;
      try {
        const { data } = await supabase
          .from('syllabus_documents')
          .select('download_count')
          .eq('id', doc.id)
          .single();
        latestSyllabusCount = data?.download_count ?? undefined;
      } catch (countError) {
        console.error('Failed to fetch updated syllabus download count', countError);
      }

      updateLocalSyllabusDownloadCount(doc.id, latestSyllabusCount);
      
      // Refresh data to show updated download counts
      loadData();
    } catch (error) {
      console.error('Download failed:', error);
      const fileId = extractGoogleDriveId(doc.file_url);

      if (fileId) {
        const webViewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
        const supported = await Linking.canOpenURL(webViewUrl);
        if (supported) {
          await Linking.openURL(webViewUrl);
        } else {
          Alert.alert(
            'Download Error',
            error instanceof Error ? error.message : 'Could not download the file. Please try again later.'
          );
        }
      } else {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to download the file. Please try again."
        );
      }
    } finally {
      setDownloading(null);
      try {
        if (downloadedFilePath) {
          await FileSystem.deleteAsync(downloadedFilePath, { idempotent: true });
        }
      } catch (cleanupError) {
        console.warn('Unable to clear temporary download', cleanupError);
      }
    }
  }

  async function downloadNote(note: Note) {
    let downloadedFilePath: string | null = null;
    try {
      setDownloading(note.id);

      const currentSubject = subjects.find((s) =>
        MATERIAL_CATEGORIES.some((category) => s.notes[category.value].some((n) => n.id === note.id)),
      );

      const categoryPrefix = note.material_category ? `${note.material_category}_` : "";
      const subjectPrefix = currentSubject ? `${(currentSubject.code || currentSubject.name.replace(/\s+/g, '-').toLowerCase())}_` : '';
      const cleanTitle = note.title.replace(/[^\w\d\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();

      let fileExtension = 'pdf';

      try {
        const url = new URL(note.file_url);
        const pathParts = url.pathname.split('.');
        if (pathParts.length > 1) fileExtension = pathParts.pop()?.toLowerCase() || 'pdf';
      } catch {
        // default to pdf when we cannot parse the url
      }

      const fileName = `${subjectPrefix}${categoryPrefix}${cleanTitle}.${fileExtension}`.toLowerCase();
      const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;

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

      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&force=true`;

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

      downloadedFilePath = result.uri;
      const mimeType = getMimeType(fileExtension);

      const saveOutcome = await persistDownloadedFile(downloadedFilePath, fileName, mimeType);

      if (saveOutcome.status === 'saved') {
        Alert.alert('Saved', `File saved to ${saveOutcome.description ?? 'your device'}.`);
      } else if (saveOutcome.status === 'shared') {
        Alert.alert('Saved', 'The file is ready to share. Choose a destination in the share sheet.');
      } else if (saveOutcome.status === 'cancelled') {
        Alert.alert('Download cancelled', 'The file was not saved.');
        return;
      } else {
        Alert.alert('Save failed', 'Could not save the file. Please try again.');
        return;
      }

      // Track download in supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Unable to record download',
          'Please sign in again and retry downloading this document.',
        );
        return;
      }

      let recorded = false;

      try {
        await supabase.rpc("track_note_download", {
          p_note_id: note.id,
          p_user_id: user.id,
          p_ip_address: null,
          p_user_agent: "College Study Mobile App",
          p_file_size: null,
        });
        recorded = true;
      } catch (trackingError) {
        console.error('track_note_download failed', trackingError);
      }

      if (!recorded) {
        try {
          await supabase.rpc("increment_download_count", { note_id: note.id });
          recorded = true;
        } catch (incrementError) {
          console.error('Failed to increment download count directly', incrementError);
        }
      }

      if (!recorded) {
        Alert.alert(
          'Download not recorded',
          'We could not record this download. Please try again later.',
        );
        return;
      }

      let latestNoteCount: number | undefined;
      try {
        const { data } = await supabase
          .from('notes')
          .select('download_count')
          .eq('id', note.id)
          .single();
        latestNoteCount = data?.download_count ?? undefined;
      } catch (countError) {
        console.error('Failed to fetch updated note download count', countError);
      }

      updateLocalNoteDownloadCount(note.id, latestNoteCount);
      
      // Refresh data to show updated download counts
      loadData();
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
            error instanceof Error ? error.message : 'Could not download the file. Please try again later.'
          );
        }
      } else {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to download the file. Please try again."
        );
      }
    } finally {
      setDownloading(null);
      try {
        if (downloadedFilePath) {
          await FileSystem.deleteAsync(downloadedFilePath, { idempotent: true });
        }
      } catch (cleanupError) {
        console.warn('Unable to clear temporary download', cleanupError);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function toggleSubject(subjectId: string) {
    setSubjects((prev) =>
      prev.map((subject) => (subject.id === subjectId ? { ...subject, expanded: !subject.expanded } : subject)),
    );
  }

  function toggleCategory(subjectId: string, category: MaterialCategory) {
    setSubjects((prev) =>
      prev.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              expandedCategories: {
                ...subject.expandedCategories,
                [category]: !subject.expandedCategories[category],
              },
            }
          : subject,
      ),
    );
  }

  function togglePyqSection() {
    setPyqExpanded((prev) => !prev);
  }

  function toggleSyllabusSection() {
    setSyllabusExpanded((prev) => !prev);
  }

  function extractGoogleDriveId(url: string): string | null {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
    const dPatternMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (dPatternMatch && dPatternMatch[1]) return dPatternMatch[1];
    const openIdMatch = url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openIdMatch && openIdMatch[1]) return openIdMatch[1];
    const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
    if (anyIdMatch && anyIdMatch[1]) return anyIdMatch[1];
    return null;
  }

  async function ensureDownloadsAccess(): Promise<string | null> {
    if (Platform.OS !== "android") return null;

    const saf = FileSystem.StorageAccessFramework;
    if (!saf) {
      console.warn("StorageAccessFramework is unavailable on this platform");
      return null;
    }

    if (downloadsDirectoryUri) return downloadsDirectoryUri;

    try {
      Alert.alert(
        "Select Download Folder",
        "Please choose the folder where notes should be saved (recommended: Downloads)."
      );

      const permissions = await saf.requestDirectoryPermissionsAsync();
      if (!permissions.granted || !permissions.directoryUri) {
        Alert.alert("Permission required", "Unable to save the file without folder access.");
        return null;
      }

      setDownloadsDirectoryUri(permissions.directoryUri);
      return permissions.directoryUri;
    } catch (error) {
      console.error("Directory permission error", error);
      Alert.alert("Permission error", "Could not access the selected folder.");
    }

    return null;
  }

  type SaveOutcome = {
    status: "saved" | "shared" | "cancelled" | "failed";
    description?: string;
  };

  async function persistDownloadedFile(localUri: string, fileName: string, mimeType: string): Promise<SaveOutcome> {
    if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
      const directoryUri = await ensureDownloadsAccess();
      if (!directoryUri) {
        return { status: "cancelled" };
      }

      try {
        const saf = FileSystem.StorageAccessFramework;
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        let destinationUri: string | null = null;
        try {
          destinationUri = await saf.createFileAsync(directoryUri, fileName, mimeType);
        } catch (error) {
          console.warn("Primary file creation failed, generating fallback name", error);
          const extensionMatch = fileName.match(/\.([^.]+)$/);
          const extension = extensionMatch ? extensionMatch[1] : "";
          const fallbackName = extension
            ? `${fileName.slice(0, -extension.length - 1)}-${Date.now()}.${extension}`
            : `${fileName}-${Date.now()}`;
          destinationUri = await saf.createFileAsync(directoryUri, fallbackName, mimeType);
        }

        if (destinationUri) {
          await FileSystem.writeAsStringAsync(destinationUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { status: "saved", description: "your selected folder" };
        }
      } catch (error) {
        console.error("Saving to selected folder failed", error);
      }
    }

    if (Platform.OS === "android") {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== "granted") {
        return { status: "cancelled" };
      }

      try {
        const asset = await MediaLibrary.createAssetAsync(localUri);
        const album = await MediaLibrary.getAlbumAsync("Download");
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync("Download", asset, false);
        }
        return { status: "saved", description: "the Downloads folder" };
      } catch (error) {
        console.error("MediaLibrary save failed", error);
        return { status: "failed" };
      }
    }

    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(localUri, {
          mimeType,
          dialogTitle: `Save ${fileName}`,
        });
        return { status: "shared" };
      } catch (error) {
        if (error instanceof Error && error.message?.toLowerCase().includes("cancel")) {
          return { status: "cancelled" };
        }
        console.error("Sharing failed", error);
        return { status: "failed" };
      }
    }

    try {
      const result = await Share.share({
        url: `file://${localUri}`,
        title: `Share ${fileName}`,
      });

      if (result.action === Share.sharedAction) {
        return { status: "shared" };
      }

      return { status: "cancelled" };
    } catch (error) {
      console.error("Share dialog failed", error);
      return { status: "failed" };
    }
  }

  function updateLocalNoteDownloadCount(noteId: string, nextCount?: number) {
    setSubjects((prevSubjects) =>
      prevSubjects.map((subject) => {
        let noteUpdated = false;

        const updatedNotes = MATERIAL_CATEGORIES.reduce((acc, category) => {
          const categoryNotes = subject.notes[category.value] || [];
          acc[category.value] = categoryNotes.map((materialNote) => {
            if (materialNote.id === noteId) {
              noteUpdated = true;
              const calculatedCount =
                typeof nextCount === "number"
                  ? nextCount
                  : materialNote.download_count + 1;
              return { ...materialNote, download_count: calculatedCount };
            }
            return materialNote;
          });
          return acc;
        }, createEmptyNotesByCategory());

        if (!noteUpdated) {
          return subject;
        }

        return {
          ...subject,
          notes: updatedNotes,
        };
      }),
    );
  }

  function updateLocalPyqDownloadCount(pyqId: string, nextCount?: number) {
    setPyqDocuments((prevPyqs) =>
      prevPyqs.map((doc) => {
        if (doc.id !== pyqId) return doc;
        const calculatedCount = typeof nextCount === "number" ? nextCount : doc.download_count + 1;
        return { ...doc, download_count: calculatedCount };
      }),
    );
  }

  function updateLocalSyllabusDownloadCount(docId: string, nextCount?: number) {
    setSyllabusDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== docId) return doc;
        const calculatedCount = typeof nextCount === "number" ? nextCount : doc.download_count + 1;
        return { ...doc, download_count: calculatedCount };
      }),
    );
  }

  function getFileTypeIcon(fileType?: string): string {
    if (!fileType) return "📄";
    const type = fileType.toLowerCase();
    if (type.includes("pdf")) return "📕";
    if (type.includes("doc")) return "📘";
    if (type.includes("ppt")) return "📙";
    if (type.includes("sheet") || type.includes("xls")) return "📊";
    return "📄";
  }

  function getCategoryNotesCount(notes: NotesByCategory): number {
    return MATERIAL_CATEGORIES.reduce((total, category) => total + (notes[category.value]?.length ?? 0), 0);
  }

  function filterSubjects(subjects: SubjectWithNotes[]): SubjectWithNotes[] {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects
      .map((subject) => {
        const subjectMatches = subject.name.toLowerCase().includes(query) || subject.code.toLowerCase().includes(query);
        const filteredNotes = createEmptyNotesByCategory();

        MATERIAL_CATEGORIES.forEach((category) => {
          filteredNotes[category.value] = subject.notes[category.value].filter((note) => noteMatchesQuery(note, query));
        });

        const hasMatchingNotes = getCategoryNotesCount(filteredNotes) > 0;
        if (subjectMatches || hasMatchingNotes) {
          return {
            ...subject,
            notes: subjectMatches ? subject.notes : filteredNotes,
          };
        }
        return null;
      })
      .filter((subject): subject is SubjectWithNotes => subject !== null);
  }

  function renderTags(tags?: string[] | null) {
    if (!tags || tags.length === 0) return null;
    return (
      <View style={styles.tagContainer}>
        {tags.map((tag) => (
          <View key={tag} style={styles.tagBadge}>
            <Text style={styles.tagBadgeText}>#{tag}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderNoteItem(note: Note) {
    return (
      <TouchableOpacity key={note.id} style={styles.noteItem} onPress={() => downloadNote(note)}>
        <View style={styles.noteIconContainer}>
          <Text style={styles.noteIcon}>{getFileTypeIcon(note.file_type)}</Text>
        </View>
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
          {note.description && (
            <Text style={styles.noteDescription} numberOfLines={1}>
              {note.description}
            </Text>
          )}
          <View style={styles.noteMetadata}>
            <View style={styles.noteStats}>
              <Download color="#999" size={10} />
              <Text style={styles.noteStatsText}>{note.download_count}</Text>
            </View>
          </View>
          {renderTags(note.tags)}
        </View>
        <View style={styles.downloadButtonContainer}>
          {downloading === note.id ? (
            <ActivityIndicator size="small" color="#0066cc" />
          ) : (
            <Download color="#0066cc" size={20} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderPyqItem(pyq: PyqDocument) {
    return (
      <TouchableOpacity key={pyq.id} style={styles.noteItem} onPress={() => downloadPyq(pyq)}>
        <View style={styles.noteIconContainer}>
          <Text style={styles.noteIcon}>{getFileTypeIcon(pyq.file_type)}</Text>
        </View>
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle} numberOfLines={2}>{pyq.title}</Text>
          {pyq.description && (
            <Text style={styles.noteDescription} numberOfLines={1}>
              {pyq.description}
            </Text>
          )}
          <View style={styles.noteMetadata}>
            <View style={styles.noteBadge}>
              <Text style={styles.noteBadgeText}>Semester {pyq.semester}</Text>
            </View>
            <View style={styles.noteStats}>
              <Download color="#999" size={10} />
              <Text style={styles.noteStatsText}>{pyq.download_count}</Text>
            </View>
          </View>
          {renderTags(pyq.tags)}
        </View>
        <View style={styles.downloadButtonContainer}>
          {downloading === pyq.id ? (
            <ActivityIndicator size="small" color="#0066cc" />
          ) : (
            <Download color="#0066cc" size={20} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderSyllabusItem(doc: SyllabusDocument) {
    return (
      <TouchableOpacity key={doc.id} style={styles.noteItem} onPress={() => downloadSyllabus(doc)}>
        <View style={styles.noteIconContainer}>
          <Text style={styles.noteIcon}>{getFileTypeIcon(doc.file_type)}</Text>
        </View>
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle} numberOfLines={2}>{doc.title}</Text>
          {doc.description && (
            <Text style={styles.noteDescription} numberOfLines={1}>
              {doc.description}
            </Text>
          )}
          <View style={styles.noteMetadata}>
            <View style={styles.noteBadge}>
              <Text style={styles.noteBadgeText}>Semester {doc.semester}</Text>
            </View>
            <View style={styles.noteStats}>
              <Download color="#999" size={10} />
              <Text style={styles.noteStatsText}>{doc.download_count}</Text>
            </View>
          </View>
          {renderTags(doc.tags)}
        </View>
        <View style={styles.downloadButtonContainer}>
          {downloading === doc.id ? (
            <ActivityIndicator size="small" color="#0066cc" />
          ) : (
            <Download color="#0066cc" size={20} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderCategory(subject: SubjectWithNotes, categoryKey: MaterialCategory, categoryLabel: string) {
    const notes = subject.notes[categoryKey];
    if (notes.length === 0) return null;

    const isExpanded = subject.expandedCategories[categoryKey];
    return (
      <View key={categoryKey} style={styles.categoryContainer}>
        <TouchableOpacity style={styles.categoryHeader} onPress={() => toggleCategory(subject.id, categoryKey)}>
          {isExpanded ? <ChevronDown color="#666" size={20} /> : <ChevronRight color="#666" size={20} />}
          <Text style={styles.categoryName}>{categoryLabel}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{notes.length}</Text>
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.notesContainer}>{notes.map((item) => renderNoteItem(item))}</View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading notes...</Text>
      </View>
    );
  }

  const filteredSubjects = filterSubjects(subjects);
  const filteredPyqs = !searchQuery.trim()
    ? pyqDocuments
    : pyqDocuments.filter((pyq) => pyqMatchesQuery(pyq, searchQuery.toLowerCase()));
  const filteredSyllabus = !searchQuery.trim()
    ? syllabusDocuments
    : syllabusDocuments.filter((doc) => syllabusMatchesQuery(doc, searchQuery.toLowerCase()));

  const hasAnyContent = filteredSubjects.length > 0 || filteredPyqs.length > 0 || filteredSyllabus.length > 0;
  const totalSubjectNotes = filteredSubjects.reduce((sum, subject) => sum + getCategoryNotesCount(subject.notes), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notes & Resources</Text>
          {profile && (
            <Text style={styles.headerSubtitle}>
              {Array.isArray(profile.branches) ? profile.branches[0]?.name : profile.branches?.name} • Semester{" "}
              {profile.semester}
            </Text>
          )}
        </View>
      </View>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color="#999" size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subjects or notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>
      {/* Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filteredSubjects.length} {filteredSubjects.length === 1 ? "subject" : "subjects"}
          {" • "}
          {totalSubjectNotes} note{totalSubjectNotes === 1 ? "" : "s"}
          {" • "}
          {filteredPyqs.length} {filteredPyqs.length === 1 ? "PYQ" : "PYQs"}
          {" • "}
          {filteredSyllabus.length} syllabus
        </Text>
      </View>
      {/* Subjects List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0066cc"]} />}
      >
        {!hasAnyContent ? (
          <View style={styles.emptyState}>
            <BookOpen color="#ccc" size={64} />
            <Text style={styles.emptyStateTitle}>No subjects found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? "Try a different search term" : "Subjects will appear here once they're added"}
            </Text>
          </View>
        ) : (
          <>
            {filteredPyqs.length > 0 && (
              <View style={styles.subjectCard}>
                <TouchableOpacity style={styles.subjectHeader} onPress={togglePyqSection}>
                  <View style={[styles.subjectIconContainer, styles.pyqIconContainer]}>
                    <FileText color="#b45309" size={24} />
                  </View>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>Previous Year Questions</Text>
                    <Text style={styles.subjectCode}>Branch-wide resources</Text>
                  </View>
                  <View style={styles.subjectRight}>
                    <View style={[styles.notesCountBadge, styles.pyqCountBadge]}>
                      <FileText color="#b45309" size={14} />
                      <Text style={[styles.notesCountText, styles.pyqCountText]}>{filteredPyqs.length}</Text>
                    </View>
                    {pyqExpanded ? (
                      <ChevronDown color="#333" size={24} />
                    ) : (
                      <ChevronRight color="#333" size={24} />
                    )}
                  </View>
                </TouchableOpacity>
                {pyqExpanded && (
                  <View style={styles.subjectContent}>
                    <View style={styles.notesContainer}>{filteredPyqs.map((pyq) => renderPyqItem(pyq))}</View>
                  </View>
                )}
              </View>
            )}
            {filteredSyllabus.length > 0 && (
              <View style={styles.subjectCard}>
                <TouchableOpacity style={styles.subjectHeader} onPress={toggleSyllabusSection}>
                  <View style={[styles.subjectIconContainer, styles.syllabusIconContainer]}>
                    <BookOpen color="#047857" size={24} />
                  </View>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>Syllabus</Text>
                    <Text style={styles.subjectCode}>Branch-wide syllabus files</Text>
                  </View>
                  <View style={styles.subjectRight}>
                    <View style={[styles.notesCountBadge, styles.syllabusCountBadge]}>
                      <BookOpen color="#047857" size={14} />
                      <Text style={[styles.notesCountText, styles.syllabusCountText]}>{filteredSyllabus.length}</Text>
                    </View>
                    {syllabusExpanded ? (
                      <ChevronDown color="#333" size={24} />
                    ) : (
                      <ChevronRight color="#333" size={24} />
                    )}
                  </View>
                </TouchableOpacity>
                {syllabusExpanded && (
                  <View style={styles.subjectContent}>
                    <View style={styles.notesContainer}>{filteredSyllabus.map((doc) => renderSyllabusItem(doc))}</View>
                  </View>
                )}
              </View>
            )}
            {filteredSubjects.map((subject) => {
              const totalNotes = getCategoryNotesCount(subject.notes);
              const hasMaterials = totalNotes > 0;

              return (
                <View key={subject.id} style={styles.subjectCard}>
                  {/* Subject Header */}
                  <TouchableOpacity style={styles.subjectHeader} onPress={() => toggleSubject(subject.id)}>
                    <View style={styles.subjectIconContainer}>
                      <BookOpen color="#0066cc" size={24} />
                    </View>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <Text style={styles.subjectCode}>{subject.code}</Text>
                    </View>
                    <View style={styles.subjectRight}>
                      {totalNotes > 0 && (
                        <View style={styles.notesCountBadge}>
                          <FileText color="#0066cc" size={14} />
                          <Text style={styles.notesCountText}>{totalNotes}</Text>
                        </View>
                      )}
                      {subject.expanded ? (
                        <ChevronDown color="#333" size={24} />
                      ) : (
                        <ChevronRight color="#333" size={24} />
                      )}
                    </View>
                  </TouchableOpacity>
                  {/* Subject Content */}
                  {subject.expanded && (
                    <View style={styles.subjectContent}>
                      {totalNotes === 0 ? (
                        <View style={styles.noNotesContainer}>
                          <Text style={styles.noNotesText}>No notes available for this subject yet</Text>
                        </View>
                      ) : (
                        <>
                          {hasMaterials && (
                            <>
                              {MATERIAL_CATEGORIES.map((category) =>
                                renderCategory(subject, category.value, category.label),
                              )}
                            </>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9fa" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 20, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#333" },
  headerSubtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 16, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e5e5" },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: "#333" },
  statsBar: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  statsText: { fontSize: 14, color: "#666", fontWeight: "500" },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyStateTitle: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 16 },
  emptyStateText: { fontSize: 14, color: "#999", marginTop: 8, textAlign: "center", paddingHorizontal: 32 },
  subjectCard: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  subjectHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  subjectIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f0f5ff", justifyContent: "center", alignItems: "center", marginRight: 12 },
  pyqIconContainer: { backgroundColor: "#fef3c7" },
  syllabusIconContainer: { backgroundColor: "#dcfce7" },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 4 },
  subjectCode: { fontSize: 13, color: "#666" },
  subjectRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  notesCountBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#e6f4ff" },
  notesCountText: { fontSize: 13, fontWeight: "600", color: "#0066cc" },
  pyqCountBadge: { backgroundColor: "#fde68a" },
  pyqCountText: { color: "#b45309" },
  syllabusCountBadge: { backgroundColor: "#bbf7d0" },
  syllabusCountText: { color: "#047857" },
  subjectContent: { borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  notesContainer: { backgroundColor: "#fff" },
  noteItem: { flexDirection: "row", alignItems: "center", padding: 12, paddingLeft: 48, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  noteIconContainer: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#f8f9fa", justifyContent: "center", alignItems: "center", marginRight: 12 },
  noteIcon: { fontSize: 20 },
  noteContent: { flex: 1 },
  noteTitle: { fontSize: 14, fontWeight: "500", color: "#333", marginBottom: 4 },
  noteDescription: { fontSize: 12, color: "#666", marginBottom: 4 },
  noteMetadata: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  noteBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#fff4e6" },
  noteBadgeText: { fontSize: 10, color: "#d46b08", fontWeight: "600" },
  noteStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  noteStatsText: { fontSize: 10, color: "#999", marginLeft: 2 },
  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: "#f0f5ff" },
  tagBadgeText: { fontSize: 11, fontWeight: "600", color: "#0066cc" },
  downloadButtonContainer: { alignItems: "center", justifyContent: "center", paddingLeft: 8 },
  downloadHint: { fontSize: 9, color: "#666", marginTop: 2, textAlign: "center", width: 50 },
  categoryContainer: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  categoryHeader: { flexDirection: "row", alignItems: "center", padding: 14, paddingLeft: 16, backgroundColor: "#fafafa" },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#333", marginLeft: 8 },
  categoryBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: "#e6f4ff", justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  categoryBadgeText: { fontSize: 12, fontWeight: "600", color: "#0066cc" },
  noNotesContainer: { padding: 24, alignItems: "center" },
  noNotesText: { fontSize: 14, color: "#999", textAlign: "center" },
  bottomSpacing: { height: 20 },
});