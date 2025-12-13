import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Modal,
  StatusBar,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { User, Camera, Check, ChevronDown, X, BookOpen, GraduationCap, Calendar, Hash, Zap } from "lucide-react-native";
import Logo from "../../src/components/Logo";

// Import profile refresh hook (we'll create a simple version for onboarding)
const useProfileRefresh = () => ({ refreshProfile: async () => {} });

const { width, height } = Dimensions.get("window");

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

export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [yearOptions, setYearOptions] = useState<YearOption[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<SemesterOption[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(4);

  // Animations
  const fadeAnimation = useState(new Animated.Value(1))[0];
  const slideAnimation = useState(new Animated.Value(0))[0];

  const [formData, setFormData] = useState({
    name: "",
    branch_id: "",
    branchName: "",
    year: "",
    semester: "",
    roll_number: "",
    photo_url: "",
    course: "B.Tech",
  });

  useEffect(() => {
    loadBranches();
    // Initialize animation
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  async function loadBranches() {
    try {
      const { data, error } = await supabase.rpc("get_all_branches_with_status");

      if (error) {
        console.error("Error loading branches:", error);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("branches")
          .select("*")
          .order("display_order", { ascending: true });

        if (fallbackData) setBranches(fallbackData);
      } else if (data) {
        setBranches(data);
      }
    } catch (error) {
      console.error("Error in loadBranches:", error);
    }
  }

  async function pickImage() {
    try {
      // Request media library permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your photo library to select a profile image.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          try {
            console.log('Starting image upload for user:', user.id);
            console.log('Selected file:', file);
            
            // Create unique filename
            const fileName = `${user.id}-${Date.now()}.jpg`;
            console.log('Generated filename:', fileName);
            
            // Upload to Supabase storage
            // Read file as base64 and convert to ArrayBuffer
            console.log('Reading file as base64...');
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            console.log('File read successfully, base64 length:', base64.length);
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            console.log('Converted to ArrayBuffer, bytes length:', bytes.length);
            
            console.log('Starting upload to Supabase...');
            const { data, error } = await supabase.storage
              .from("profiles")
              .upload(fileName, bytes, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (error) {
              console.error('Upload error:', error);
              console.error('Error details:', JSON.stringify(error, null, 2));
              throw new Error(`Upload failed: ${error.message}`);
            }

            console.log('Upload successful:', data);

            // Get public URL
            const { data: urlData } = await supabase.storage
              .from("profiles")
              .getPublicUrl(fileName);
              
            console.log('Upload successful, public URL:', urlData.publicUrl);
            setFormData({ ...formData, photo_url: urlData.publicUrl });
            console.log('Updated formData.photo_url to:', urlData.publicUrl);
            
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            Alert.alert('Error', 'Failed to upload profile photo. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  }

  async function completeProfile() {
    if (!formData.name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!formData.branch_id) {
      Alert.alert("Error", "Please select your branch");
      return;
    }
    if (!formData.year || !formData.semester) {
      Alert.alert("Error", "Please select year and semester");
      return;
    }

    // Validate year-semester relationship and check if they're active
    const year = parseInt(formData.year);
    const semester = parseInt(formData.semester);

    // Check if the selected year and semester are active for the selected branch
    try {
      const { data: isValid, error: validationError } = await supabase.rpc("can_register_for_combination", {
        p_branch_id: formData.branch_id,
        p_year_number: year,
        p_semester_number: semester,
      });

      if (validationError || !isValid) {
        Alert.alert(
          "Error",
          "The selected year and semester combination is not currently available. Please select a different option.",
        );
        return;
      }
    } catch (error) {
      console.error("Validation error:", error);
      Alert.alert("Error", "Unable to validate your selection. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("users")
        .update({
          name: formData.name.trim(),
          branch_id: formData.branch_id,
          year: parseInt(formData.year),
          semester: parseInt(formData.semester),
          roll_number: formData.roll_number.trim(),
          photo_url: formData.photo_url,
          course: formData.course,
          last_login: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  // State for active years and semesters
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [activeSemesters, setActiveSemesters] = useState<number[]>([]);

  // Load all years with status when branch is selected
  async function loadActiveYears(branchId: string) {
    if (!branchId) {
      setYearOptions([]);
      setSemesterOptions([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_all_years_with_status", {
        p_branch_id: branchId,
      });

      if (data && !error) {
        setYearOptions(data);
        const activeYearNumbers = data.filter((y: any) => y.can_select).map((y: any) => y.year_number);
        setActiveYears(activeYearNumbers);
      } else {
        console.error("Error loading years:", error);
        const fallbackYears = [1, 2, 3, 4].map((year) => ({
          year_number: year,
          display_label: `Year ${year}`,
          can_select: true,
          status_reason: "",
        }));
        setYearOptions(fallbackYears);
        setActiveYears([1, 2, 3, 4]);
      }
    } catch (error) {
      console.error("Error in loadActiveYears:", error);
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
        const activeSemesterNumbers = data.filter((s: any) => s.can_select).map((s: any) => s.semester_number);
        setActiveSemesters(activeSemesterNumbers);
      } else {
        console.error("Error loading semesters:", error);
        const fallbackSemesters = getDefaultSemesters(year);
        setSemesterOptions(fallbackSemesters);
      }
    } catch (error) {
      console.error("Error in loadActiveSemesters:", error);
    }
  }

  // Helper function to get default semesters based on year
  function getDefaultSemesters(year: number): SemesterOption[] {
    const startSemester = (year - 1) * 2 + 1;
    return [
      {
        semester_number: startSemester,
        semester_label: `Semester ${startSemester}`,
        can_select: true,
        status_reason: "",
      },
      {
        semester_number: startSemester + 1,
        semester_label: `Semester ${startSemester + 1}`,
        can_select: true,
        status_reason: "",
      },
    ];
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

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return formData.branch_id.length > 0;
      case 3:
        return formData.year.length > 0 && formData.semester.length > 0;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <View key={index} style={styles.stepContainer}>
          <View
            style={[
              styles.stepCircle,
              index < currentStep
                ? styles.stepCompleted
                : index === currentStep - 1
                  ? styles.stepActive
                  : styles.stepInactive,
            ]}
          >
            {index < currentStep - 1 ? (
              <Check color="#fff" size={16} />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  index === currentStep - 1 ? styles.stepNumberActive : styles.stepNumberInactive,
                ]}
              >
                {index + 1}
              </Text>
            )}
          </View>
          {index < totalSteps - 1 && (
            <View
              style={[styles.stepLine, index < currentStep - 1 ? styles.stepLineCompleted : styles.stepLineInactive]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <Animated.View
      style={[
        styles.stepContent,
        {
          opacity: fadeAnimation,
          transform: [
            {
              translateY: slideAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Personal Information</Text>
        <Text style={styles.stepSubtitle}>Let's start with your basic details</Text>
      </View>

      {/* Profile Photo */}
      <View style={styles.photoSection}>
        <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
          {formData.photo_url ? (
            <Image source={{ uri: formData.photo_url }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Camera color="#0066cc" size={32} />
              <Text style={styles.photoText}>Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.photoHint}>Optional but recommended</Text>
      </View>

      {/* Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <View style={styles.inputContainer}>
          <User color="#999" size={20} />
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholderTextColor="#999"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnimation }]}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Academic Details</Text>
        <Text style={styles.stepSubtitle}>Select your branch of study</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Branch *</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowBranchPicker(true)}>
          <View style={styles.pickerContent}>
            <BookOpen color={formData.branchName ? "#0066cc" : "#999"} size={20} />
            <Text style={[styles.pickerText, !formData.branchName && styles.pickerPlaceholder]}>
              {formData.branchName || "Select your branch"}
            </Text>
          </View>
          <ChevronDown color="#999" size={20} />
        </TouchableOpacity>
      </View>

      {formData.branchName && (
        <View style={styles.selectedInfo}>
          <Check color="#52c41a" size={16} />
          <Text style={styles.selectedText}>{branches.find((b) => b.id === formData.branch_id)?.full_name}</Text>
        </View>
      )}
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnimation }]}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Academic Year</Text>
        <Text style={styles.stepSubtitle}>Choose your current year and semester</Text>
      </View>

      {/* Year Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Year *</Text>
        <View style={styles.optionGrid}>
          {formData.branch_id ? (
            yearOptions.length > 0 ? (
              yearOptions.map((yearOption) => (
                <TouchableOpacity
                  key={yearOption.year_number}
                  style={[
                    styles.optionCard,
                    formData.year === yearOption.year_number.toString() && styles.optionCardActive,
                    !yearOption.can_select && styles.optionCardDisabled,
                  ]}
                  disabled={!yearOption.can_select}
                  onPress={() => {
                    if (!yearOption.can_select) {
                      Alert.alert("Year Unavailable", yearOption.status_reason);
                      return;
                    }
                    setFormData({ ...formData, year: yearOption.year_number.toString(), semester: "" });
                    loadActiveSemesters(formData.branch_id, yearOption.year_number);
                  }}
                >
                  <Text
                    style={[
                      styles.optionCardNumber,
                      formData.year === yearOption.year_number.toString() && styles.optionCardNumberActive,
                      !yearOption.can_select && styles.optionCardNumberDisabled,
                    ]}
                  >
                    {yearOption.year_number}
                  </Text>
                  <Text
                    style={[
                      styles.optionCardLabel,
                      formData.year === yearOption.year_number.toString() && styles.optionCardLabelActive,
                      !yearOption.can_select && styles.optionCardLabelDisabled,
                    ]}
                  >
                    Year
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.placeholderText}>No years available</Text>
            )
          ) : (
            <Text style={styles.placeholderText}>Select branch first</Text>
          )}
        </View>
      </View>

      {/* Semester Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Semester *
          {formData.year && <Text style={styles.labelHint}> ({getSemesterLabel(parseInt(formData.year))})</Text>}
        </Text>
        <View style={styles.optionGrid}>
          {formData.year ? (
            semesterOptions.length > 0 ? (
              semesterOptions.map((semesterOption) => (
                <TouchableOpacity
                  key={semesterOption.semester_number}
                  style={[
                    styles.optionCardSmall,
                    formData.semester === semesterOption.semester_number.toString() && styles.optionCardActive,
                    !semesterOption.can_select && styles.optionCardDisabled,
                  ]}
                  disabled={!semesterOption.can_select}
                  onPress={() => {
                    if (!semesterOption.can_select) {
                      Alert.alert("Semester Unavailable", semesterOption.status_reason);
                      return;
                    }
                    setFormData({ ...formData, semester: semesterOption.semester_number.toString() });
                  }}
                >
                  <Text
                    style={[
                      styles.optionCardNumber,
                      formData.semester === semesterOption.semester_number.toString() && styles.optionCardNumberActive,
                      !semesterOption.can_select && styles.optionCardNumberDisabled,
                    ]}
                  >
                    {semesterOption.semester_number}
                  </Text>
                  <Text
                    style={[
                      styles.optionCardLabel,
                      formData.semester === semesterOption.semester_number.toString() && styles.optionCardLabelActive,
                      !semesterOption.can_select && styles.optionCardLabelDisabled,
                    ]}
                  >
                    Sem
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.placeholderText}>No semesters available</Text>
            )
          ) : (
            <Text style={styles.placeholderText}>Select year first</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );

  const renderStep4 = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnimation }]}>
      <View style={styles.stepHeader}>

        <Text style={styles.stepTitle}>Additional Details</Text>
        <Text style={styles.stepSubtitle}>Complete your profile</Text>
      </View>

      {/* Course (Fixed) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Course</Text>
        <View style={styles.disabledInputContainer}>
          <GraduationCap color="#999" size={20} />
          <Text style={styles.disabledInputText}>B.Tech (Bachelor of Technology)</Text>
        </View>
      </View>

      {/* Roll Number */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Roll Number</Text>
        <View style={styles.inputContainer}>
          <Hash color="#999" size={20} />
          <TextInput
            style={styles.input}
            placeholder="e.g., 21001 (Optional)"
            value={formData.roll_number}
            onChangeText={(text) => setFormData({ ...formData, roll_number: text })}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Profile Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Name:</Text>
          <Text style={styles.summaryValue}>{formData.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Branch:</Text>
          <Text style={styles.summaryValue}>{formData.branchName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Academic:</Text>
          <Text style={styles.summaryValue}>
            Year {formData.year}, Semester {formData.semester}
          </Text>
        </View>
        {formData.roll_number && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Roll Number:</Text>
            <Text style={styles.summaryValue}>{formData.roll_number}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complete Your Profile</Text>
        <Text style={styles.headerSubtitle}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>

      {/* Progress Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderCurrentStep()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <View style={styles.navigationButtons}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={prevStep}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled, loading && styles.nextButtonLoading]}
            onPress={currentStep === totalSteps ? completeProfile : nextStep}
            disabled={!canProceed() || loading}
          >
            <Text style={styles.nextButtonText}>
              {loading ? "Setting up..." : currentStep === totalSteps ? "Complete Setup" : "Continue"}
            </Text>
            {!loading && <Zap color="#fff" size={20} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Branch Picker Modal */}
      <Modal
        visible={showBranchPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBranchPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowBranchPicker(false)} style={styles.modalCloseButton}>
                <X color="#666" size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {branches.map((branch) => (
                <TouchableOpacity
                  key={branch.id}
                  style={[
                    styles.modalOption,
                    formData.branch_id === branch.id && styles.modalOptionSelected,
                    !branch.is_active && styles.modalOptionDisabled,
                  ]}
                  disabled={!branch.is_active}
                  onPress={() => {
                    if (!branch.is_active) {
                      Alert.alert(
                        "Branch Unavailable",
                        branch.status_reason || "This branch is currently not accepting new registrations.",
                      );
                      return;
                    }
                    setFormData({
                      ...formData,
                      branch_id: branch.id,
                      branchName: branch.name,
                      year: "",
                      semester: "",
                    });
                    loadActiveYears(branch.id);
                    setShowBranchPicker(false);
                  }}
                >
                  <View style={styles.modalOptionContent}>
                    <Text style={[styles.modalOptionText, !branch.is_active && styles.modalOptionTextDisabled]}>
                      {branch.name}
                    </Text>
                    <Text style={[styles.modalOptionSubtext, !branch.is_active && styles.modalOptionTextDisabled]}>
                      {branch.full_name}
                    </Text>
                    <Text style={[styles.modalOptionCode, !branch.is_active && styles.modalOptionTextDisabled]}>
                      ({branch.code})
                    </Text>
                    {!branch.is_active && <Text style={styles.modalOptionStatus}>{branch.status_reason}</Text>}
                  </View>
                  {formData.branch_id === branch.id && <Check color="#0066cc" size={24} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: "#52c41a",
  },
  stepActive: {
    backgroundColor: "#0066cc",
  },
  stepInactive: {
    backgroundColor: "#e5e5e5",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "700",
  },
  stepNumberActive: {
    color: "#ffffff",
  },
  stepNumberInactive: {
    color: "#999",
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: "#52c41a",
  },
  stepLineInactive: {
    backgroundColor: "#e5e5e5",
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  stepIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f8ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  photoContainer: {
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f8ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0066cc",
    borderStyle: "dashed",
  },
  photoText: {
    color: "#0066cc",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  photoHint: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  labelHint: {
    fontSize: 12,
    color: "#666",
    fontWeight: "normal",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "#f8f9fa",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 16,
    marginLeft: 12,
  },
  picker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#f8f9fa",
  },
  pickerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pickerText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  pickerPlaceholder: {
    color: "#999",
  },
  selectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f6ffed",
    borderRadius: 8,
    gap: 8,
  },
  selectedText: {
    fontSize: 14,
    color: "#52c41a",
    fontWeight: "600",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionCard: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e5e5e5",
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  optionCardSmall: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e5e5e5",
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  optionCardActive: {
    backgroundColor: "#0066cc",
    borderColor: "#0066cc",
  },
  optionCardDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
    opacity: 0.6,
  },
  optionCardNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#333",
    marginBottom: 2,
  },
  optionCardNumberActive: {
    color: "#fff",
  },
  optionCardNumberDisabled: {
    color: "#999",
  },
  optionCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  optionCardLabelActive: {
    color: "#e6f4ff",
  },
  optionCardLabelDisabled: {
    color: "#999",
  },
  disabledInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#f5f5f5",
  },
  disabledInputText: {
    fontSize: 16,
    color: "#666",
    marginLeft: 12,
  },
  summaryCard: {
    backgroundColor: "#f0f8ff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e6f4ff",
    marginTop: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0066cc",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    width: 80,
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },
  placeholderText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  bottomNav: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  navigationButtons: {
    flexDirection: "row",
    gap: 16,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "#e5e5e5",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#666",
  },
  nextButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0066cc",
    gap: 8,
    shadowColor: "#0066cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonDisabled: {
    backgroundColor: "#d9d9d9",
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonLoading: {
    opacity: 0.8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#333",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    paddingHorizontal: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "transparent",
  },
  modalOptionSelected: {
    backgroundColor: "#e6f4ff",
    borderColor: "#0066cc",
  },
  modalOptionDisabled: {
    backgroundColor: "#f5f5f5",
    opacity: 0.7,
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "700",
    marginBottom: 4,
  },
  modalOptionSubtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  modalOptionCode: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  modalOptionTextDisabled: {
    color: "#999",
  },
  modalOptionStatus: {
    fontSize: 11,
    color: "#ff4d4f",
    fontStyle: "italic",
    marginTop: 4,
  },
});
