import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useProfileRefresh } from "../(tabs)/home";
import {
  User,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Camera,
  Save,
  X,
  ChevronDown,
  ImageIcon,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

interface Branch {
  id: string;
  code: string;
  name: string;
  full_name: string;
  is_active?: boolean;
  status_reason?: string;
}

interface YearOption {
  year_number: number;
  display_label?: string;
  can_select: boolean;
  status_reason: string;
}

interface SemesterOption {
  semester_number: number;
  semester_label?: string;
  can_select: boolean;
  status_reason: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  branch_id: string;
  year: number;
  semester: number;
  roll_number?: string;
  photo_url?: string;
  course?: string;
  phone?: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  branch_id: string;
  year: string;
  semester: string;
  roll_number: string;
  course: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  branch_id?: string;
  year?: string;
  semester?: string;
  roll_number?: string;
}

export default function EditProfile() {
  const router = useRouter();
  const { refreshProfile } = useProfileRefresh();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [activeSemesters, setActiveSemesters] = useState<number[]>([]);
  const [yearOptions, setYearOptions] = useState<YearOption[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<SemesterOption[]>([]);
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    branch_id: "",
    year: "",
    semester: "",
    roll_number: "",
    course: "B.Tech",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [photoUri, setPhotoUri] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/(auth)/welcome");
        return;
      }

      // Load all branches with status (with fallback)
      try {
        const { data: branchesData, error: branchError } = await supabase.rpc("get_all_branches_with_status");
        if (branchError) {
          console.warn("Branch RPC failed, loading basic branches:", branchError);
          // Fallback to basic branch loading
          const { data: basicBranches } = await supabase
            .from("branches")
            .select("id, code, name, full_name, is_active")
            .eq("is_active", true);
          setBranches(
            (basicBranches || []).map((b) => ({
              ...b,
              can_select: b.is_active,
              status_reason: b.is_active ? "Available" : "Inactive",
            })),
          );
        } else {
          setBranches(branchesData || []);
        }
      } catch (branchLoadError) {
        console.error("Error loading branches:", branchLoadError);
        setBranches([]);
      }

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        Alert.alert("Error", "Failed to load profile data. Please try again.");
        return;
      }

      if (profileData) {
        setProfile(profileData);
        setFormData({
          name: profileData.name || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          branch_id: profileData.branch_id || "",
          year: profileData.year?.toString() || "",
          semester: profileData.semester?.toString() || "",
          roll_number: profileData.roll_number || "",
          course: "B.Tech",
        });

        // Load active years for current branch if exists
        if (profileData.branch_id) {
          try {
            await loadActiveYears(profileData.branch_id);
            if (profileData.year) {
              await loadActiveSemesters(profileData.branch_id, profileData.year);
            }
          } catch (yearSemError) {
            console.warn("Error loading year/semester data:", yearSemError);
            // Continue with fallback data
          }
        }
      }
    } catch (error) {
      console.error("Critical error loading data:", error);
      Alert.alert("Error", "Failed to load profile data. Please restart the app and try again.");
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Phone validation (optional but if provided, should be valid)
    if (formData.phone.trim() && !/^[6-9]\d{9}$/.test(formData.phone.replace(/\s+/g, ""))) {
      newErrors.phone = "Please enter a valid 10-digit phone number";
    }

    // Branch validation
    if (!formData.branch_id) {
      newErrors.branch_id = "Branch is required";
    }

    // Year validation
    if (!formData.year) {
      newErrors.year = "Year is required";
    } else if (![1, 2, 3, 4].includes(parseInt(formData.year))) {
      newErrors.year = "Year must be 1, 2, 3, or 4";
    }

    // Semester validation
    if (!formData.semester) {
      newErrors.semester = "Semester is required";
    } else {
      const sem = parseInt(formData.semester);
      const year = parseInt(formData.year);
      if (year) {
        const validSemesters = getDefaultSemesters(year);
        if (!validSemesters.includes(sem)) {
          newErrors.semester = `Year ${year} can only have semesters ${validSemesters.join(" or ")}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the errors before saving");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | null | undefined = profile?.photo_url; // Start with existing photo URL
      console.log("Initial photoUrl:", photoUrl);
      console.log("photoUri state:", photoUri);

      // Handle photo upload if there's a new photo
      if (photoUri) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            // Create unique filename
            const fileExt = photoUri.split(".").pop()?.toLowerCase() || "jpg";
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            console.log("Starting photo upload:", fileName);

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(photoUri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Convert base64 to array buffer
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            // Upload to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("profiles")
              .upload(fileName, byteArray, {
                contentType: `image/${fileExt}`,
                upsert: true,
              });

            if (uploadError) {
              console.error("Upload error details:", uploadError);
              throw new Error(`Photo upload failed: ${uploadError.message}`);
            }

            console.log("Upload successful:", uploadData);

            // Get public URL
            const { data: urlData } = supabase.storage.from("profiles").getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;

            console.log("Public URL:", photoUrl);
          }
        } catch (uploadError: any) {
          console.error("Error uploading photo:", uploadError);
          Alert.alert(
            "Upload Error",
            `Failed to upload profile photo: ${uploadError.message || "Network error"}. Please check your internet connection and try again.`,
            [
              {
                text: "Save Without Photo",
                onPress: () => {
                  // Continue with save
                },
              },
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => {
                  setSaving(false);
                  return;
                },
              },
            ],
          );
          return; // Stop the save process if upload fails
        }
      } else if (photoUri === null && profile?.photo_url) {
        // Photo was explicitly removed by user
        photoUrl = null; // Use null to actually remove from database
        console.log("Photo was removed by user, setting photo_url to null");
      }

      // Build update data with only core fields that definitely exist
      const updateData: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        branch_id: formData.branch_id,
        year: parseInt(formData.year),
        semester: parseInt(formData.semester),
        course: "B.Tech",
        updated_at: new Date().toISOString(),
      };

      // Handle photo URL updates
      const originalPhotoUrl = profile?.photo_url;
      if (photoUrl !== originalPhotoUrl) {
        updateData.photo_url = photoUrl;
        console.log("Photo URL changed from", originalPhotoUrl, "to", photoUrl);
      }

      // Add optional fields only if they have values
      if (formData.roll_number.trim()) {
        updateData.roll_number = formData.roll_number.trim();
      }

      // Try to add phone - if column doesn't exist, update will still work without it
      if (formData.phone.trim()) {
        updateData.phone = formData.phone.trim();
      }

      const { error } = await supabase.from("users").update(updateData).eq("id", profile?.id);

      if (error) {
        // If phone column doesn't exist, try update without phone
        if (error.message?.includes("phone") && updateData.phone) {
          delete updateData.phone;
          const { error: retryError } = await supabase.from("users").update(updateData).eq("id", profile?.id);
          if (retryError) throw retryError;

          Alert.alert(
            "Profile Updated",
            "Profile updated successfully! Note: Phone number will be available after database update.",
            [
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ],
          );
        } else {
          throw error;
        }
      } else {
        // Trigger profile refresh across the app
        console.log('Profile updated successfully, triggering app-wide refresh');
        await refreshProfile();
        
        Alert.alert("Success", "Profile updated successfully!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // Helper function to get valid semesters for a given year
  // Load all years with status when branch is selected
  async function loadActiveYears(branchId: string) {
    if (!branchId) {
      setYearOptions([]);
      setSemesterOptions([]);
      setActiveYears([]);
      setActiveSemesters([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_all_years_with_status", {
        p_branch_id: branchId,
      });

      if (data && !error) {
        setYearOptions(data);
        // Also update the legacy activeYears for backward compatibility
        const activeYearNumbers = data.filter((y: any) => y.can_select).map((y: any) => y.year_number);
        setActiveYears(activeYearNumbers);
      } else {
        console.warn("RPC get_all_years_with_status failed, using fallback:", error);
        // Fallback - try to load basic year data
        try {
          const { data: basicYears } = await supabase
            .from("branch_years")
            .select("year_number, is_active")
            .eq("branch_id", branchId);

          if (basicYears && basicYears.length > 0) {
            const yearOptions = basicYears.map((y) => ({
              year_number: y.year_number,
              display_label: `Year ${y.year_number}`,
              can_select: y.is_active,
              status_reason: y.is_active ? "Available" : "Currently unavailable",
            }));
            setYearOptions(yearOptions);
            setActiveYears(basicYears.filter((y) => y.is_active).map((y) => y.year_number));
          } else {
            throw new Error("No year data found");
          }
        } catch (fallbackError) {
          console.warn("Basic year loading failed, using default years:", fallbackError);
          const fallbackYears = [1, 2, 3, 4].map((year) => ({
            year_number: year,
            display_label: `Year ${year}`,
            can_select: true,
            status_reason: "Available (fallback)",
          }));
          setYearOptions(fallbackYears);
          setActiveYears([1, 2, 3, 4]);
        }
      }
    } catch (error) {
      console.error("Critical error in loadActiveYears:", error);
      const fallbackYears = [1, 2, 3, 4].map((year) => ({
        year_number: year,
        display_label: `Year ${year}`,
        can_select: true,
        status_reason: "Available (fallback)",
      }));
      setYearOptions(fallbackYears);
      setActiveYears([1, 2, 3, 4]);
    }
  }

  // Load all semesters with status when year is selected
  async function loadActiveSemesters(branchId: string, year: number) {
    if (!branchId || !year) {
      setSemesterOptions([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_all_semesters_with_status", {
        p_branch_id: branchId,
        p_year_number: year,
      });

      if (data && !error) {
        setSemesterOptions(data);
        // Also update legacy activeSemesters for backward compatibility
        const activeSemesterNumbers = data.filter((s: any) => s.can_select).map((s: any) => s.semester_number);
        setActiveSemesters(activeSemesterNumbers);
      } else {
        console.error("Error loading semesters:", error);
        // Fallback to default year-semester mapping
        const defaultSemesters = getDefaultSemesters(year);
        const fallbackSemesters = defaultSemesters.map((sem) => ({
          semester_number: sem,
          semester_label: `Semester ${sem}`,
          can_select: true,
          status_reason: "Available",
        }));
        setSemesterOptions(fallbackSemesters);
        setActiveSemesters(defaultSemesters);
      }
    } catch (error) {
      console.error("Error in loadActiveSemesters:", error);
      // Fallback to default year-semester mapping
      const defaultSemesters = getDefaultSemesters(year);
      const fallbackSemesters = defaultSemesters.map((sem) => ({
        semester_number: sem,
        semester_label: `Semester ${sem}`,
        can_select: true,
        status_reason: "Available",
      }));
      setSemesterOptions(fallbackSemesters);
      setActiveSemesters(defaultSemesters);
    }
  }

  // Helper function for default semester mapping (fallback)
  function getDefaultSemesters(year: number): number[] {
    switch (year) {
      case 1:
        return [1, 2];
      case 2:
        return [3, 4];
      case 3:
        return [5, 6];
      case 4:
        return [7, 8];
      default:
        return [];
    }
  }

  // Helper function to get semester label
  function getSemesterLabel(year: number): string {
    if (activeSemesters.length > 0) {
      return activeSemesters.join(" or ");
    }
    // Fallback labels
    switch (year) {
      case 1:
        return "1st or 2nd";
      case 2:
        return "3rd or 4th";
      case 3:
        return "5th or 6th";
      case 4:
        return "7th or 8th";
      default:
        return "";
    }
  }

  async function handlePhotoSelection() {
    const options = ["Camera", "Photo Library", "Remove Photo", "Cancel"];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 3,
          destructiveButtonIndex: profile?.photo_url || photoUri ? 2 : -1,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            // Camera
            await pickImageFromCamera();
          } else if (buttonIndex === 1) {
            // Photo Library
            await pickImageFromLibrary();
          } else if (buttonIndex === 2 && (profile?.photo_url || photoUri)) {
            // Remove photo
            setPhotoUri(null);
          }
        },
      );
    } else {
      // Android alert fallback
      Alert.alert(
        "Change Profile Photo",
        "Select an option to update your profile photo",
        [
          { text: "Camera", onPress: pickImageFromCamera },
          { text: "Gallery", onPress: pickImageFromLibrary },
          profile?.photo_url || photoUri
            ? {
                text: "Remove",
                style: "destructive",
                onPress: () => {
                  setPhotoUri(null);
                },
              }
            : null,
          { text: "Cancel", style: "cancel" },
        ].filter(Boolean) as any,
      );
    }
  }

  async function pickImageFromCamera() {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

      if (cameraPermission.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to take photos. Please enable it in your device settings.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("Selected image from camera:", asset);

        // Validate image size (5MB limit)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select an image smaller than 5MB.");
          return;
        }

        setPhotoUri(asset.uri);
      }
    } catch (error) {
      console.error("Error picking image from camera:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }

  async function pickImageFromLibrary() {
    try {
      // Request media library permissions
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (libraryPermission.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Media library permission is required to select photos. Please enable it in your device settings.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("Selected image from library:", asset);

        // Validate image size (5MB limit)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select an image smaller than 5MB.");
          return;
        }

        setPhotoUri(asset.uri);
      }
    } catch (error) {
      console.error("Error picking image from library:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  }

  function getBranchName(branchId: string): string {
    if (!branchId || !branches || branches.length === 0) {
      return "Select Branch";
    }
    const branch = branches.find((b) => b.id === branchId);
    return branch ? `${branch.code} - ${branch.name}` : "Select Branch";
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Error state if no profile loaded
  if (!loading && !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to Load Profile</Text>
        <Text style={styles.errorMessage}>
          There was an error loading your profile data. Please check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <X color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#0066cc" /> : <Save color="#0066cc" size={24} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoContainer} onPress={handlePhotoSelection}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.profilePhoto} />
            ) : photoUri === null ? (
              <View style={styles.photoPlaceholder}>
                <User color="#0066cc" size={48} />
              </View>
            ) : profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <User color="#0066cc" size={48} />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Camera color="#fff" size={16} />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change profile photo</Text>
          {(photoUri !== null || profile?.photo_url) ? (
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => {
                setPhotoUri(null);
              }}
            >
              <Text style={styles.removePhotoText}>Remove Photo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Full Name <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.inputContainer, errors.name ? styles.inputError : undefined]}>
              <User color="#999" size={20} />
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => {
                  setFormData({ ...formData, name: text });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Branch Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Branch <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.pickerContainer, errors.branch_id ? styles.inputError : undefined]}
              onPress={() => setShowBranchPicker(true)}
            >
              <BookOpen color="#999" size={20} />
              <Text style={[styles.pickerText, !formData.branch_id ? styles.pickerPlaceholder : undefined]}>
                {getBranchName(formData.branch_id)}
              </Text>
              <ChevronDown color="#999" size={20} />
            </TouchableOpacity>
            {errors.branch_id && <Text style={styles.errorText}>{errors.branch_id}</Text>}
          </View>

          {/* Year and Semester Row */}
          <View style={styles.rowContainer}>
            <View style={[styles.fieldGroup, styles.halfWidth]}>
              <Text style={styles.label}>
                Year <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.pickerContainer, errors.year ? styles.inputError : undefined]}
                onPress={() => setShowYearPicker(true)}
              >
                <Calendar color="#999" size={20} />
                <Text style={[styles.pickerText, !formData.year && styles.pickerPlaceholder]}>
                  {formData.year ? `Year ${formData.year}` : "Select Year"}
                </Text>
              </TouchableOpacity>
              {formData.year && (
                <Text style={styles.semesterHint}> ({getSemesterLabel(parseInt(formData.year))})</Text>
              )}
            </View>

            <View style={[styles.fieldGroup, styles.halfWidth]}>
              <Text style={styles.label}>
                Semester <Text style={styles.required}>*</Text>
                {formData.year && (
                  <Text style={styles.semesterHint}> ({getSemesterLabel(parseInt(formData.year))})</Text>
                )}
              </Text>
              <TouchableOpacity
                style={[styles.pickerContainer, errors.semester ? styles.inputError : undefined]}
                onPress={() => setShowSemesterPicker(true)}
              >
                <Calendar color="#999" size={20} />
                <Text style={[styles.pickerText, !formData.semester && styles.pickerPlaceholder]}>
                  {formData.semester ? `Sem ${formData.semester}` : "Select Sem"}
                </Text>
                <ChevronDown color="#999" size={20} />
              </TouchableOpacity>
              {errors.semester && <Text style={styles.errorText}>{errors.semester}</Text>}
            </View>
          </View>

          {/* Roll Number Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Roll Number</Text>
            <View style={[styles.inputContainer, errors.roll_number ? styles.inputError : undefined]}>
              <Text style={styles.rollIcon}>#</Text>
              <TextInput
                style={styles.textInput}
                value={formData.roll_number}
                onChangeText={(text) => setFormData({ ...formData, roll_number: text })}
                placeholder="Enter your roll number"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Branch Picker Modal */}
      {showBranchPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowBranchPicker(false)}>
                <X color="#333" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerContent}>
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.pickerItem, !branch.is_active && styles.pickerItemDisabled]}
                    disabled={!branch.is_active}
                    onPress={() => {
                      if (!branch.is_active) {
                        Alert.alert(
                          "Branch Unavailable",
                          branch.status_reason || "This branch is currently not accepting updates.",
                        );
                        return;
                      }
                      setFormData({ ...formData, branch_id: branch.id, year: "", semester: "" });
                      setShowBranchPicker(false);
                      if (errors.branch_id) setErrors({ ...errors, branch_id: undefined });
                      loadActiveYears(branch.id);
                    }}
                  >
                    <Text style={[styles.pickerItemCode, !branch.is_active && styles.pickerItemTextDisabled]}>
                      {branch.code}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </Text>
                    <View style={styles.pickerItemContent}>
                      <Text style={[styles.pickerItemName, !branch.is_active && styles.pickerItemTextDisabled]}>
                        {branch.name}
                      </Text>
                      <Text style={[styles.pickerItemFullName, !branch.is_active && styles.pickerItemTextDisabled]}>
                        {branch.full_name}
                      </Text>
                      {!branch.is_active && <Text style={styles.pickerItemStatus}>{branch.status_reason}</Text>}
                    </View>
                    {formData.branch_id === branch.id && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.pickerItem}>
                  <Text style={styles.pickerItemText}>No branches available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Year Picker Modal */}
      {showYearPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Year</Text>
              <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                <X color="#333" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContent}>
              {formData && formData.branch_id ? (
                yearOptions && yearOptions.length > 0 ? (
                  yearOptions.map((yearOption) => (
                    <TouchableOpacity
                      key={yearOption.year_number}
                      style={[styles.pickerItem, !yearOption.can_select && styles.pickerItemDisabled]}
                      disabled={!yearOption.can_select}
                      onPress={() => {
                        if (!yearOption.can_select) {
                          Alert.alert("Year Unavailable", yearOption.status_reason);
                          return;
                        }
                        setFormData({ ...formData, year: yearOption.year_number.toString(), semester: "" });
                        setShowYearPicker(false);
                        if (errors.year) setErrors({ ...errors, year: undefined });
                        loadActiveSemesters(formData.branch_id, yearOption.year_number);
                      }}
                    >
                      <Text style={[styles.pickerItemText, !yearOption.can_select && styles.pickerItemTextDisabled]}>
                        Year {yearOption.year_number}
                      </Text>
                      {!yearOption.can_select && (
                        <Text style={styles.pickerItemStatus}>{yearOption.status_reason}</Text>
                      )}
                      {formData.year === yearOption.year_number.toString() && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.pickerItem}>
                    <Text style={styles.pickerItemText}>Loading years...</Text>
                  </View>
                )
              ) : (
                <View style={styles.pickerItem}>
                  <Text style={styles.pickerItemText}>Please select branch first</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Semester Picker Modal */}
      {showSemesterPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Semester</Text>
              <TouchableOpacity onPress={() => setShowSemesterPicker(false)}>
                <X color="#333" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContent}>
              {formData.year ? (
                semesterOptions.length > 0 ? (
                  semesterOptions.map((semesterOption) => (
                    <TouchableOpacity
                      key={semesterOption.semester_number}
                      style={[styles.pickerItem, !semesterOption.can_select && styles.pickerItemDisabled]}
                      disabled={!semesterOption.can_select}
                      onPress={() => {
                        if (!semesterOption.can_select) {
                          Alert.alert("Semester Unavailable", semesterOption.status_reason);
                          return;
                        }
                        setFormData({ ...formData, semester: semesterOption.semester_number.toString() });
                        setShowSemesterPicker(false);
                        if (errors.semester) setErrors({ ...errors, semester: undefined });
                      }}
                    >
                      <Text
                        style={[styles.pickerItemText, !semesterOption.can_select && styles.pickerItemTextDisabled]}
                      >
                        Semester {semesterOption.semester_number}
                      </Text>
                      {!semesterOption.can_select && (
                        <Text style={styles.pickerItemStatus}>{semesterOption.status_reason}</Text>
                      )}
                      {formData.semester === semesterOption.semester_number.toString() && (
                        <Text style={styles.checkMark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  getDefaultSemesters(parseInt(formData.year)).map((semester) => (
                    <TouchableOpacity
                      key={semester}
                      style={styles.pickerItem}
                      onPress={() => {
                        setFormData({ ...formData, semester: semester.toString() });
                        setShowSemesterPicker(false);
                        if (errors.semester) setErrors({ ...errors, semester: undefined });
                      }}
                    >
                      <Text style={styles.pickerItemText}>Semester {semester}</Text>
                      {formData.semester === semester.toString() && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))
                )
              ) : (
                <View style={styles.pickerItem}>
                  <Text style={styles.pickerItemText}>Select year first</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
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
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
  },
  photoSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  photoContainer: {
    position: "relative",
    marginBottom: 12,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e6f4ff",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0066cc",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  photoHint: {
    fontSize: 14,
    color: "#666",
  },
  removePhotoButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#fff2f2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffcccc",
  },
  removePhotoText: {
    fontSize: 12,
    color: "#ff4d4f",
    textAlign: "center",
  },
  formSection: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  halfWidth: {
    flex: 1,
  },
  rowContainer: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#ff4d4f",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    gap: 12,
  },
  inputError: {
    borderColor: "#ff4d4f",
    backgroundColor: "#fff2f2",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  rollIcon: {
    fontSize: 20,
    color: "#999",
    fontWeight: "600",
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    gap: 12,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  pickerPlaceholder: {
    color: "#999",
  },
  errorText: {
    fontSize: 12,
    color: "#ff4444",
    marginTop: 4,
  },
  semesterHint: {
    fontSize: 12,
    color: "#666",
    fontWeight: "normal",
  },
  placeholderContainer: {
    padding: 16,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  disabledInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  disabledInputText: {
    fontSize: 16,
    color: "#666",
    marginLeft: 12,
    flex: 1,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "80%",
    width: "100%",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  pickerContent: {
    padding: 8,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  pickerItemCode: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  pickerItemContent: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  pickerItemFullName: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  checkMark: {
    fontSize: 20,
    color: "#0066cc",
    fontWeight: "bold",
  },
  pickerItemDisabled: {
    backgroundColor: "#f8f8f8",
    opacity: 0.7,
  },
  pickerItemTextDisabled: {
    color: "#999",
    opacity: 0.7,
  },
  pickerItemStatus: {
    fontSize: 11,
    color: "#ff6b6b",
    fontStyle: "italic",
    marginTop: 2,
  },
  fieldHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  bottomSpacing: {
    height: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
