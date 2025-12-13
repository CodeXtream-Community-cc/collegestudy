import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Calculator, X, RotateCcw, BookOpen, Plus, Minus, Search } from "lucide-react-native";
import { supabase } from "../lib/supabase";

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits: number;
  current_marks: number;
  current_grade_point: number;
  grade?: string;
  is_core: boolean;
  branch_name: string;
}

interface AvailableSubject {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits: number;
  is_core: boolean;
  branch_name: string;
}

type SubjectBranchRow = {
  branches?: { name?: string } | { name?: string }[] | null;
  subjects:
    | SubjectData
    | SubjectData[];
};

type SubjectData = {
  id?: string;
  name?: string;
  code?: string;
  credits?: number | null;
  semester?: number | null;
  is_core?: boolean | null;
  is_active?: boolean | null;
};

interface UserProfile {
  branch_id: string | null;
  semester: number | null;
  year: number | null;
  branches?:
    | {
        name: string;
        code: string;
      }
    | {
        name: string;
        code: string;
      }[]
    | null;
}

interface CGPACalculatorProps {
  userId: string;
  userSemester?: number | null;
  userYear?: number | null;
  userBranchId?: string | null;
}

export const CGPACalculator: React.FC<CGPACalculatorProps> = ({ 
  userId, 
  userSemester, 
  userYear, 
  userBranchId 
}) => {
  console.log('CGPA Calculator: Props updated', {
    userId,
    userSemester,
    userYear,
    userBranchId
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [addSubjectModalVisible, setAddSubjectModalVisible] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<AvailableSubject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [sgpa, setSgpa] = useState(0);
  const [summary, setSummary] = useState({
    subjects_count: 0,
    completed_subjects: 0,
    completion_percentage: 0,
    total_credits: 0,
    completed_credits: 0,
  });
  const [isResetting, setIsResetting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastKnownProfile, setLastKnownProfile] = useState<{ semester?: number | null; year?: number | null; branchId?: string | null }>({});

  // Effect to detect profile changes and reset CGPA calculator
  useEffect(() => {
    const currentProfile = { semester: userSemester, year: userYear, branchId: userBranchId };
    
    // Check if semester or year has changed (branch change doesn't require clearing CGPA)
    const hasChanged = 
      lastKnownProfile.semester !== userSemester ||
      lastKnownProfile.year !== userYear;
    
    // Also handle initial load
    const isInitialLoad = Object.keys(lastKnownProfile).length === 0;
    
    if (isInitialLoad || hasChanged) {
      console.log('CGPA Calculator: Semester/Year changed, clearing all selected subjects', {
        currentProfile,
        lastKnownProfile,
        isInitialLoad,
        hasChanged,
        userSemester,
        userYear,
        userBranchId
      });
      
      if (!isInitialLoad && hasChanged) {
        // For actual changes, set resetting flag and clear database immediately
        setIsResetting(true);
        clearAllSubjectsFromDatabase();
        
        Alert.alert(
          "CGPA Reset",
          "Your CGPA calculator has been reset due to semester/year change. You can now add subjects for the new semester/year.",
          [{ text: "OK" }]
        );
        
        // Clear resetting flag after a short delay to allow database operations
        setTimeout(() => {
          setIsResetting(false);
        }, 1000);
      }
      
      // Clear local state immediately
      setSubjects([]);
      setAvailableSubjects([]);
      setFilteredSubjects([]);
      setSearchQuery("");
      setSgpa(0);
      setSummary({
        subjects_count: 0,
        completed_subjects: 0,
        completion_percentage: 0,
        total_credits: 0,
        completed_credits: 0,
      });
      setProfile(null);
      
      // Update last known profile IMMEDIATELY to prevent repeated resets
      setLastKnownProfile(currentProfile);
    }
  }, [userSemester, userYear, userBranchId]); // Only depend on profile changes

  // Separate effect for loading subjects when modal opens (after reset is done)
  useEffect(() => {
    if (modalVisible) {
      console.log('CGPA Calculator: Modal opened, loading subjects');
      loadSubjects();
    }
  }, [modalVisible]);

  // Separate effect for loading available subjects when add modal opens
  useEffect(() => {
    if (addSubjectModalVisible && availableSubjects.length === 0) {
      console.log('CGPA Calculator: Add subject modal opened, loading available subjects');
      loadAvailableSubjects();
    }
  }, [addSubjectModalVisible, availableSubjects.length]);

  useEffect(() => {
    const filtered = availableSubjects.filter((subject) => {
      const query = searchQuery.toLowerCase();
      return (
        subject.subject_name.toLowerCase().includes(query) ||
        subject.subject_code.toLowerCase().includes(query) ||
        subject.branch_name.toLowerCase().includes(query)
      );
    });
    setFilteredSubjects(filtered);
  }, [searchQuery, availableSubjects]);

  // Add manual refresh function
  const manualRefresh = async () => {
    console.log('CGPA Calculator: Manual refresh triggered');
    setIsResetting(true);
    await clearAllSubjectsFromDatabase();
    
    // Clear local state
    setSubjects([]);
    setAvailableSubjects([]);
    setFilteredSubjects([]);
    setSearchQuery("");
    setSgpa(0);
    setSummary({
      subjects_count: 0,
      completed_subjects: 0,
      completion_percentage: 0,
      total_credits: 0,
      completed_credits: 0,
    });
    setProfile(null);
    
    Alert.alert(
      "CGPA Reset",
      "CGPA calculator has been manually reset. All subjects have been cleared.",
      [{ text: "OK" }]
    );
    
    setTimeout(() => {
      setIsResetting(false);
    }, 1000);
  };

  const clearAllSubjectsFromDatabase = async () => {
    try {
      console.log('CGPA Calculator: Clearing all subjects from database for user', userId);
      
      // First, let's see what subjects exist
      const { data: existingSubjects, error: checkError } = await supabase
        .from('cgpa_records')
        .select('*')
        .eq('user_id', userId);
        
      if (checkError) {
        console.error('Error checking existing subjects:', checkError);
      } else {
        console.log('CGPA Calculator: Found existing subjects to delete:', existingSubjects?.length || 0);
      }
      
      // Now delete all subjects
      const { error } = await supabase
        .from('cgpa_records')
        .delete()
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error clearing subjects from database:', error);
      } else {
        console.log('CGPA Calculator: Successfully cleared all subjects from database');
        
        // Verify deletion
        const { data: remainingSubjects, error: verifyError } = await supabase
          .from('cgpa_records')
          .select('*')
          .eq('user_id', userId);
          
        if (verifyError) {
          console.error('Error verifying deletion:', verifyError);
        } else {
          console.log('CGPA Calculator: Remaining subjects after deletion:', remainingSubjects?.length || 0);
        }
      }
    } catch (error) {
      console.error('Error in clearAllSubjectsFromDatabase:', error);
    }
  };

  const fetchProfile = async (): Promise<UserProfile | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("branch_id, semester, year, branches(name, code)")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
        return profile;
      }

      if (data) {
        const formatted: UserProfile = {
          branch_id: data.branch_id ?? null,
          semester: data.semester ?? null,
          year: data.year ?? null,
          branches: data.branches ?? null,
        };
        setProfile(formatted);
        return formatted;
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
    return profile;
  };

  const loadSubjects = async () => {
    // Prevent loading if we're in the middle of a reset
    if (isResetting) {
      console.log('CGPA Calculator: Skipping loadSubjects because reset is in progress');
      return;
    }
    
    setLoading(true);
    try {
      console.log('CGPA Calculator: Loading subjects for user', userId);
      
      await fetchProfile();

      // Get user's selected subjects with marks
      let subjectsData;
      let subjectsError;
      
      try {
        const result = await supabase.rpc("get_user_selected_subjects", {
          p_user_id: userId,
        });
        subjectsData = result.data;
        subjectsError = result.error;
      } catch (rpcError) {
        console.error('RPC function error:', rpcError);
        // Fallback to direct query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cgpa_records')
          .select(`
            *,
            subjects (
              id,
              name,
              code,
              credits,
              is_core,
              branches (name)
            )
          `)
          .eq('user_id', userId);
          
        if (fallbackError) {
          subjectsError = fallbackError;
        } else {
          subjectsData = fallbackData?.map(record => ({
            subject_id: record.subjects.id,
            subject_name: record.subjects.name,
            subject_code: record.subjects.code,
            credits: record.subjects.credits,
            current_marks: record.current_marks,
            current_grade_point: record.current_grade_point,
            grade: record.grade,
            is_core: record.subjects.is_core,
            branch_name: record.subjects.branches?.name || 'Unknown'
          }));
        }
      }

      if (subjectsError) {
        console.error("Error loading subjects:", subjectsError);
        if (subjectsError.message.includes("does not exist")) {
          Alert.alert("Setup Required", "Please run the database migration first to enable CGPA calculator.");
        } else {
          Alert.alert("Error", `Failed to load subjects: ${subjectsError.message}`);
        }
        return;
      }

      console.log('CGPA Calculator: Loaded subjects', subjectsData);
      setSubjects(subjectsData || []);

      // Get CGPA summary
      const { data: summaryData, error: summaryError } = await supabase.rpc("get_cgpa_summary", { p_user_id: userId });

      if (summaryError) {
        console.error("Error loading summary:", summaryError);
      } else if (summaryData?.success) {
        setSgpa(summaryData.sgpa || 0);
        setSummary({
          subjects_count: summaryData.subjects_count || 0,
          completed_subjects: summaryData.completed_subjects || 0,
          completion_percentage: summaryData.completion_percentage || 0,
          total_credits: summaryData.total_credits || 0,
          completed_credits: summaryData.completed_credits || 0,
        });
      }
    } catch (error) {
      console.error("Error in loadSubjects:", error);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSubjects = async () => {
    try {
      console.log('CGPA Calculator: Loading available subjects');
      
      const activeProfile = profile ?? (await fetchProfile());

      if (!activeProfile?.branch_id || !activeProfile.semester) {
        console.log('CGPA Calculator: Profile incomplete', { branch_id: activeProfile?.branch_id, semester: activeProfile?.semester });
        Alert.alert("Profile incomplete", "Please update your branch and semester to add subjects.");
        setAvailableSubjects([]);
        return;
      }

      console.log('CGPA Calculator: Fetching subjects for branch', activeProfile.branch_id, 'semester', activeProfile.semester);

      const { data: subjectRows, error } = await supabase
        .from("subject_branches")
        .select(
          `
            branches ( name ),
            subjects!inner (
              id,
              name,
              code,
              credits,
              semester,
              is_active
            )
          `,
        )
        .eq("branch_id", activeProfile.branch_id)
        .eq("subjects.semester", activeProfile.semester)
        .eq("subjects.is_active", true)
        .order("name", { foreignTable: "subjects" });

      if (error) {
        console.error("Error loading available subjects:", error);
        Alert.alert("Error", `Failed to load available subjects: ${error.message}`);
        return;
      }

      const profileBranchName = Array.isArray(activeProfile.branches)
        ? activeProfile.branches[0]?.name
        : activeProfile.branches?.name;

      const rows = (subjectRows ?? []) as SubjectBranchRow[];

      const extracted: AvailableSubject[] = rows
        .flatMap((row) => {
          const branchNameSource = row.branches;
          const branchNameFromRow = Array.isArray(branchNameSource)
            ? branchNameSource[0]?.name
            : branchNameSource?.name;
          const subjectData = row.subjects;
          const subjectsArray = (Array.isArray(subjectData) ? subjectData : [subjectData]) as SubjectData[];

          return subjectsArray
            .filter((subject): subject is SubjectData & { id: string; name: string; code: string } =>
              Boolean(subject?.id && subject.name && subject.code),
            )
            .map((subject) => ({
              subject_id: subject.id,
              subject_name: subject.name,
              subject_code: subject.code,
              credits: subject.credits ?? 0,
              is_core: subject.is_core ?? true,
              branch_name: branchNameFromRow || profileBranchName || "Branch",
            }));
        })
        .filter((subject, index, self) => index === self.findIndex((item) => item.subject_id === subject.subject_id));

      const selectedSubjectIds = subjects.map((s) => s.subject_id);
      const filtered = extracted.filter((subject) => !selectedSubjectIds.includes(subject.subject_id));

      setAvailableSubjects(filtered);
    } catch (error) {
      console.error("Error in loadAvailableSubjects:", error);
      Alert.alert("Error", "Failed to load available subjects");
    }
  };

  const addSubject = async (subjectId: string) => {
    setAddingSubject(true);
    try {
      const { data, error } = await supabase.rpc("add_subject_to_cgpa", {
        p_user_id: userId,
        p_subject_id: subjectId,
      });

      if (error) {
        console.error("Error adding subject:", error);
        Alert.alert("Error", "Failed to add subject");
        return;
      }

      if (data?.success) {
        Alert.alert("Success", `${data.subject_name} added to your subjects!`);
        setAddSubjectModalVisible(false);
        setSearchQuery("");
        await loadSubjects(); // Reload to show new subject
        await loadAvailableSubjects(); // Update available list
      } else {
        Alert.alert("Error", data?.error || "Failed to add subject");
      }
    } catch (error) {
      console.error("Error in addSubject:", error);
      Alert.alert("Error", "Failed to add subject");
    } finally {
      setAddingSubject(false);
    }
  };

  const removeSubject = async (subjectId: string) => {
    try {
      const { data, error } = await supabase.rpc("remove_subject_from_cgpa", {
        p_user_id: userId,
        p_subject_id: subjectId,
      });

      if (error) {
        console.error("Error removing subject:", error);
        Alert.alert("Error", "Failed to remove subject");
        return;
      }

      if (data?.success) {
        Alert.alert("Success", `${data.subject_name} removed from your subjects!`);
        await loadSubjects(); // Reload subjects
        await loadAvailableSubjects(); // Update available list
      } else {
        Alert.alert("Error", data?.error || "Failed to remove subject");
      }
    } catch (error) {
      console.error("Error in removeSubject:", error);
      Alert.alert("Error", "Failed to remove subject");
    }
  };

  const updateMarks = (subjectId: string, marks: string) => {
    const marksNumber = parseInt(marks) || 0;
    if (marksNumber > 100) return; // Prevent marks over 100

    setSubjects((prev) =>
      prev.map((subject) =>
        subject.subject_id === subjectId
          ? {
              ...subject,
              current_marks: marksNumber,
              current_grade_point: calculateGradePoint(marksNumber),
            }
          : subject,
      ),
    );
  };

  const calculateGradePoint = (marks: number): number => {
    if (marks >= 90) return 10.0;
    if (marks >= 80) return 9.0;
    if (marks >= 70) return 8.0;
    if (marks >= 60) return 7.0;
    if (marks >= 50) return 6.0;
    if (marks >= 40) return 5.0;
    if (marks >= 30) return 4.0;
    return 0.0;
  };

  const calculateCurrentSGPA = (): number => {
    let totalGradePoints = 0;
    let totalCredits = 0;

    subjects.forEach((subject) => {
      if (subject.current_marks > 0) {
        totalGradePoints += subject.current_grade_point * subject.credits;
        totalCredits += subject.credits;
      }
    });

    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
  };

  const saveAllMarks = async () => {
    setSaving(true);
    try {
      const subjectsWithMarks = subjects.filter((s) => s.current_marks > 0);

      if (subjectsWithMarks.length === 0) {
        Alert.alert("No Data", "Please enter marks for at least one subject.");
        return;
      }

      for (const subject of subjectsWithMarks) {
        const { data, error } = await supabase.rpc("save_cgpa_record", {
          p_user_id: userId,
          p_subject_id: subject.subject_id,
          p_marks: subject.current_marks,
        });

        if (error) {
          console.error("Error saving marks for", subject.subject_name, error);
          throw error;
        }
      }

      // Reload data to get updated summary
      await loadSubjects();

      Alert.alert("Success", "Marks saved successfully!");
    } catch (error) {
      console.error("Error saving marks:", error);
      Alert.alert("Error", "Failed to save marks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getGradeColor = (gradePoint: number): string => {
    if (gradePoint >= 9) return "#52c41a";
    if (gradePoint >= 8) return "#73d13d";
    if (gradePoint >= 7) return "#faad14";
    if (gradePoint >= 6) return "#fa8c16";
    if (gradePoint >= 5) return "#f5222d";
    return "#d9d9d9";
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.calculatorCard} onPress={() => setModalVisible(true)}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Calculator color="#0066cc" size={24} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>CGPA Calculator</Text>
            <Text style={styles.cardSubtitle}>
              {summary.completed_subjects}/{summary.subjects_count} subjects completed
            </Text>
          </View>
          <View style={styles.sgpaContainer}>
            <Text style={styles.sgpaLabel}>Current SGPA</Text>
            <Text style={[styles.sgpaValue, { color: getGradeColor(sgpa) }]}>{sgpa.toFixed(2)}</Text>
          </View>
        </View>

        {summary.completion_percentage > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${summary.completion_percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>{summary.completion_percentage.toFixed(1)}% Complete</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Main CGPA Calculator Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>CGPA Calculator</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.refreshButton} onPress={manualRefresh}>
                <RotateCcw color="#0066cc" size={20} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <X color="#666" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Loading subjects...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{calculateCurrentSGPA().toFixed(2)}</Text>
                    <Text style={styles.summaryLabel}>Calculated SGPA</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{subjects.filter((s) => s.current_marks > 0).length}</Text>
                    <Text style={styles.summaryLabel}>Subjects Entered</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {subjects.filter((s) => s.current_marks > 0).reduce((sum, s) => sum + s.credits, 0)}
                    </Text>
                    <Text style={styles.summaryLabel}>Credits</Text>
                  </View>
                </View>
              </View>

              {/* Add Subject Button */}
              <TouchableOpacity
                style={styles.addSubjectButton}
                onPress={() => {
                  setAddSubjectModalVisible(true);
                  loadAvailableSubjects();
                }}
              >
                <Plus color="#0066cc" size={20} />
                <Text style={styles.addSubjectText}>Add Subject</Text>
              </TouchableOpacity>

              {subjects.length === 0 ? (
                <View style={styles.emptyState}>
                  <BookOpen color="#ccc" size={48} />
                  <Text style={styles.emptyStateText}>No subjects added yet</Text>
                  <Text style={styles.emptyStateSubtext}>Tap "Add Subject" to get started</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.instructionText}>Enter your marks out of 100 for each subject:</Text>

                  {subjects.map((subject) => (
                    <View key={subject.subject_id} style={styles.subjectCard}>
                      <View style={styles.subjectHeader}>
                        <View style={styles.subjectInfo}>
                          <Text style={styles.subjectName}>{subject.subject_name}</Text>
                          <Text style={styles.subjectCode}>
                            {subject.subject_code} • {subject.credits} Credits
                            {!subject.is_core && <Text style={styles.electiveTag}> • Elective</Text>}
                          </Text>
                          <Text style={styles.branchName}>{subject.branch_name}</Text>
                        </View>
                        <View style={styles.subjectActions}>
                          <View style={styles.gradeDisplay}>
                            <Text style={[styles.gradePoint, { color: getGradeColor(subject.current_grade_point) }]}>
                              {subject.current_grade_point.toFixed(1)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeSubject(subject.subject_id)}
                          >
                            <Minus color="#ff4d4f" size={16} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.marksInputContainer}>
                        <TextInput
                          style={styles.marksInput}
                          placeholder="Marks (0-100)"
                          value={subject.current_marks > 0 ? subject.current_marks.toString() : ""}
                          onChangeText={(text) => updateMarks(subject.subject_id, text)}
                          keyboardType="numeric"
                          maxLength={3}
                        />
                        <Text style={styles.marksUnit}>/ 100</Text>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={saveAllMarks}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <RotateCcw color="#fff" size={20} />
                        <Text style={styles.saveButtonText}>Save All Marks</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.gradeScaleCard}>
                <Text style={styles.gradeScaleTitle}>Grading Scale</Text>
                <View style={styles.gradeScaleItems}>
                  <Text style={styles.gradeScaleItem}>90-100: 10.0 (A+)</Text>
                  <Text style={styles.gradeScaleItem}>80-89: 9.0 (A)</Text>
                  <Text style={styles.gradeScaleItem}>70-79: 8.0 (B+)</Text>
                  <Text style={styles.gradeScaleItem}>60-69: 7.0 (B)</Text>
                  <Text style={styles.gradeScaleItem}>50-59: 6.0 (C)</Text>
                  <Text style={styles.gradeScaleItem}>40-49: 5.0 (D)</Text>
                  <Text style={styles.gradeScaleItem}>Below 40: 0.0 (F)</Text>
                </View>
              </View>

              <View style={styles.bottomSpacing} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={addSubjectModalVisible}
        onRequestClose={() => setAddSubjectModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Subject</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setAddSubjectModalVisible(false);
                setSearchQuery("");
              }}
            >
              <X color="#666" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search color="#666" size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search subjects..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredSubjects.length === 0 ? (
              <View style={styles.emptyState}>
                <BookOpen color="#ccc" size={48} />
                <Text style={styles.emptyStateText}>{searchQuery ? "No subjects found" : "No available subjects"}</Text>
              </View>
            ) : (
              filteredSubjects.map((subject) => (
                <TouchableOpacity
                  key={subject.subject_id}
                  style={styles.availableSubjectCard}
                  onPress={() => addSubject(subject.subject_id)}
                  disabled={addingSubject}
                >
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{subject.subject_name}</Text>
                    <Text style={styles.subjectCode}>
                      {subject.subject_code} • {subject.credits} Credits
                    </Text>
                    <Text style={styles.branchName}>
                      {subject.branch_name} {!subject.is_core && "• Elective"}
                    </Text>
                  </View>
                  <Plus color="#0066cc" size={20} />
                </TouchableOpacity>
              ))
            )}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  calculatorCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e6f7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  sgpaContainer: {
    alignItems: "center",
  },
  sgpaLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  sgpaValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0066cc",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0066cc",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  addSubjectButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0066cc",
    borderStyle: "dashed",
  },
  addSubjectText: {
    fontSize: 16,
    color: "#0066cc",
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    fontWeight: "500",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 16,
    fontWeight: "500",
  },
  subjectCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  subjectCode: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  electiveTag: {
    color: "#0066cc",
    fontWeight: "500",
  },
  branchName: {
    fontSize: 12,
    color: "#999",
  },
  subjectActions: {
    alignItems: "center",
    marginLeft: 8,
  },
  gradeDisplay: {
    alignItems: "center",
    marginBottom: 8,
  },
  gradePoint: {
    fontSize: 20,
    fontWeight: "bold",
  },
  removeButton: {
    padding: 4,
    backgroundColor: "#fff1f0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffccc7",
  },
  marksInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  marksInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
  },
  marksUnit: {
    fontSize: 16,
    color: "#666",
    marginLeft: 8,
  },
  gradeScaleCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
  },
  gradeScaleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  gradeScaleItems: {
    gap: 4,
  },
  gradeScaleItem: {
    fontSize: 14,
    color: "#666",
    paddingVertical: 2,
  },
  saveButton: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  availableSubjectCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bottomSpacing: {
    height: 32,
  },
});
