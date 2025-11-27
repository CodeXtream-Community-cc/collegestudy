"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  AlertCircle,
  X,
  Loader2,
  FileText,
  CalendarCheck,
} from "lucide-react";

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  subject_branches?: { branch_id?: string | null }[];
  branch_ids?: string[];
}

interface TimetableEntry {
  id: string;
  branch_id: string;
  semester: number;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  faculty_name?: string;
  class_type?: string;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    branches?: {
      name: string;
      code: string;
    };
  };
}

interface ExamSchedule {
  id: string;
  branch_id?: string; // Keeping for backward compatibility
  semester: number;
  subject_id: string;
  exam_type: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_number?: string;
  total_marks?: number;
  instructions?: string;
  created_at: string;
  exam_schedule_branches?: {
    branch_id: string;
    branches?: {
      id: string;
      name: string;
      code: string;
    };
  }[];
  subjects?: {
    id: string;
    name: string;
    code: string;
    branches?: {
      name: string;
      code: string;
    };
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CLASS_TYPES = ["Lecture", "Lab", "Tutorial", "Practical"];
const EXAM_TYPES = ["Mid Sem 1", "Mid Sem 2", "End Sem", "Practical"];

export default function TimetablePage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "exams">("timetable");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TimetableEntry | ExamSchedule | null>(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state for Timetable
  const [timetableForm, setTimetableForm] = useState({
    branch_id: "",
    semester: 1,
    subject_id: "",
    day_of_week: 1,
    start_time: "",
    end_time: "",
    room_number: "",
    faculty_name: "",
    class_type: "Lecture",
  });

  // Form state for Exam
  const [examForm, setExamForm] = useState({
    branch_ids: [] as string[], // Multiple branches
    semester: 1,
    subject_id: "",
    exam_type: "Mid Sem 1",
    exam_date: "",
    start_time: "",
    end_time: "",
    room_number: "",
    total_marks: 100,
    instructions: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedBranch, selectedSemester, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch branches
      const { data: branchesData } = await supabase.from("branches").select("*").order("name");
      setBranches(branchesData || []);

      // Fetch subjects through subject_branches junction to respect many-to-many mapping
      let subjectsQuery;

      if (selectedBranch) {
        subjectsQuery = supabase
          .from("subjects")
          .select(
            `
            *,
            subject_branches:subject_branches!inner (
              branch_id
            )
          `,
          )
          .eq("is_active", true)
          .eq("subject_branches.branch_id", selectedBranch);
      } else {
        subjectsQuery = supabase
          .from("subjects")
          .select(
            `
            *,
            subject_branches (
              branch_id
            )
          `,
          )
          .eq("is_active", true);
      }

      if (selectedSemester) {
        subjectsQuery = subjectsQuery.eq("semester", parseInt(selectedSemester));
      }

      const { data: subjectsData } = await subjectsQuery.order("semester").order("name");

      const processedSubjects = (subjectsData || []).map((subject: Subject) => {
        const branchIds = (subject.subject_branches || [])
          .map((sb) => sb?.branch_id)
          .filter((id): id is string => Boolean(id));

        return {
          ...subject,
          branch_ids: branchIds,
        };
      });

      setSubjects(processedSubjects);

      if (activeTab === "timetable") {
        // Fetch timetable entries
        let timetableQuery = supabase.from("timetable").select(`
            *,
            subjects (
              id,
              name,
              code,
              branches (
                name,
                code
              )
            )
          `);

        if (selectedBranch) {
          timetableQuery = timetableQuery.eq("branch_id", selectedBranch);
        }
        if (selectedSemester) {
          timetableQuery = timetableQuery.eq("semester", parseInt(selectedSemester));
        }

        const { data: timetableData } = await timetableQuery.order("day_of_week").order("start_time");
        setTimetableEntries(timetableData || []);
      } else {
        // Fetch exam schedules with multiple branches support
        let examQuery = supabase.from("exam_schedule").select(`
            *,
            exam_schedule_branches (
              branch_id,
              branches (
                id,
                name,
                code
              )
            ),
            subjects (
              id,
              name,
              code,
              branches (
                name,
                code
              )
            )
          `);

        // Filter by selected branch if specified
        if (selectedBranch) {
          examQuery = examQuery.eq("exam_schedule_branches.branch_id", selectedBranch);
        }
        if (selectedSemester) {
          examQuery = examQuery.eq("semester", parseInt(selectedSemester));
        }

        const { data: examData } = await examQuery.order("exam_date").order("start_time");
        setExamSchedules(examData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimetable = async () => {
    try {
      const { error } = await supabase.from("timetable").insert([timetableForm]);
      if (error) throw error;

      setShowAddModal(false);
      resetTimetableForm();
      fetchData();
    } catch (error) {
      console.error("Error adding timetable:", error);
      alert("Failed to add timetable entry");
    }
  };

  const handleUpdateTimetable = async () => {
    if (!editingItem) return;
    try {
      const { error } = await supabase.from("timetable").update(timetableForm).eq("id", editingItem.id);
      if (error) throw error;

      setEditingItem(null);
      resetTimetableForm();
      fetchData();
    } catch (error) {
      console.error("Error updating timetable:", error);
      alert("Failed to update timetable entry");
    }
  };

  const handleDeleteTimetable = async (id: string) => {
    if (!confirm("Are you sure you want to delete this timetable entry?")) return;
    try {
      const { error } = await supabase.from("timetable").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting timetable:", error);
      alert("Failed to delete timetable entry");
    }
  };

  const handleAddExam = async () => {
    try {
      // Insert exam schedule first
      const { data: examData, error: examError } = await supabase
        .from("exam_schedule")
        .insert([{
          semester: examForm.semester,
          subject_id: examForm.subject_id,
          exam_type: examForm.exam_type,
          exam_date: examForm.exam_date,
          start_time: examForm.start_time,
          end_time: examForm.end_time,
          room_number: examForm.room_number,
          total_marks: examForm.total_marks,
          instructions: examForm.instructions,
        }])
        .select()
        .single();

      if (examError) throw examError;

      // Insert branch associations
      if (examForm.branch_ids.length > 0) {
        const branchAssociations = examForm.branch_ids.map(branch_id => ({
          exam_schedule_id: examData.id,
          branch_id
        }));

        const { error: branchError } = await supabase
          .from("exam_schedule_branches")
          .insert(branchAssociations);

        if (branchError) throw branchError;
      }

      setShowAddModal(false);
      resetExamForm();
      fetchData();
    } catch (error) {
      console.error("Error adding exam:", error);
      alert("Failed to add exam schedule");
    }
  };

  const handleUpdateExam = async () => {
    if (!editingItem) return;
    try {
      // Update exam schedule
      const { error: examError } = await supabase
        .from("exam_schedule")
        .update({
          semester: examForm.semester,
          subject_id: examForm.subject_id,
          exam_type: examForm.exam_type,
          exam_date: examForm.exam_date,
          start_time: examForm.start_time,
          end_time: examForm.end_time,
          room_number: examForm.room_number,
          total_marks: examForm.total_marks,
          instructions: examForm.instructions,
        })
        .eq("id", editingItem.id);

      if (examError) throw examError;

      // Update branch associations - delete existing and insert new ones
      const { error: deleteError } = await supabase
        .from("exam_schedule_branches")
        .delete()
        .eq("exam_schedule_id", editingItem.id);

      if (deleteError) throw deleteError;

      if (examForm.branch_ids.length > 0) {
        const branchAssociations = examForm.branch_ids.map(branch_id => ({
          exam_schedule_id: editingItem.id,
          branch_id
        }));

        const { error: insertError } = await supabase
          .from("exam_schedule_branches")
          .insert(branchAssociations);

        if (insertError) throw insertError;
      }

      setEditingItem(null);
      resetExamForm();
      fetchData();
    } catch (error) {
      console.error("Error updating exam:", error);
      alert("Failed to update exam schedule");
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exam schedule?")) return;
    try {
      // Delete from junction table first (will cascade due to foreign key constraint)
      const { error: branchError } = await supabase
        .from("exam_schedule_branches")
        .delete()
        .eq("exam_schedule_id", id);

      if (branchError) throw branchError;

      // Delete the exam schedule
      const { error } = await supabase.from("exam_schedule").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting exam:", error);
      alert("Failed to delete exam schedule");
    }
  };

  const getDeleteScopeLabel = (entity: "timetable entries" | "exam schedules") => {
    const scopeParts: string[] = [];
    if (selectedBranch) {
      const branch = branches.find((item) => item.id === selectedBranch);
      scopeParts.push(`branch ${branch ? `${branch.name} (${branch.code})` : "selection"}`);
    }
    if (selectedSemester) {
      scopeParts.push(`semester ${selectedSemester}`);
    }
    if (scopeParts.length === 0) {
      return `all ${entity}`;
    }
    if (scopeParts.length === 1) {
      return `${entity} for ${scopeParts[0]}`;
    }
    return `${entity} for ${scopeParts.join(" and ")}`;
  };

  const handleDeleteAllTimetable = async () => {
    const semesterNumber = selectedSemester ? parseInt(selectedSemester, 10) : null;
    const hasMatchingEntries = timetableEntries.some((entry) => {
      if (selectedBranch && entry.branch_id !== selectedBranch) {
        return false;
      }
      if (semesterNumber !== null && entry.semester !== semesterNumber) {
        return false;
      }
      return true;
    });

    if (!hasMatchingEntries) {
      alert("No timetable entries found for the current filters.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${getDeleteScopeLabel("timetable entries")}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      let deleteQuery = supabase.from("timetable").delete();
      if (selectedBranch) {
        deleteQuery = deleteQuery.eq("branch_id", selectedBranch);
      }
      if (semesterNumber !== null) {
        deleteQuery = deleteQuery.eq("semester", semesterNumber);
      }
      const { error } = await deleteQuery;
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting all timetable entries:", error);
      alert("Failed to delete timetable entries");
    }
  };

  const handleDeleteAllExams = async () => {
    const semesterNumber = selectedSemester ? parseInt(selectedSemester, 10) : null;
    const hasMatchingEntries = examSchedules.some((exam) => {
      // Check if exam matches the selected branch filter
      if (selectedBranch) {
        const hasSelectedBranch = exam.exam_schedule_branches?.some(
          esb => esb.branch_id === selectedBranch
        ) || exam.branch_id === selectedBranch;
        if (!hasSelectedBranch) return false;
      }
      if (semesterNumber !== null && exam.semester !== semesterNumber) {
        return false;
      }
      return true;
    });

    if (!hasMatchingEntries) {
      alert("No exam schedules found for the current filters.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${getDeleteScopeLabel("exam schedules")}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      // First, get the exam IDs that match the criteria
      let examQuery = supabase.from("exam_schedule").select("id");
      
      if (selectedBranch) {
        examQuery = examQuery.in("id", 
          examSchedules
            .filter(exam => 
              exam.exam_schedule_branches?.some(esb => esb.branch_id === selectedBranch) ||
              exam.branch_id === selectedBranch
            )
            .map(exam => exam.id)
        );
      }
      if (semesterNumber !== null) {
        examQuery = examQuery.eq("semester", semesterNumber);
      }
      
      const { data: matchingExams } = await examQuery;
      
      if (matchingExams && matchingExams.length > 0) {
        const examIds = matchingExams.map(exam => exam.id);
        
        // Delete from junction table first
        const { error: branchError } = await supabase
          .from("exam_schedule_branches")
          .delete()
          .in("exam_schedule_id", examIds);
          
        if (branchError) throw branchError;
        
        // Delete the exam schedules
        const { error } = await supabase
          .from("exam_schedule")
          .delete()
          .in("id", examIds);
          
        if (error) throw error;
      }
      
      fetchData();
    } catch (error) {
      console.error("Error deleting exam schedules:", error);
      alert("Failed to delete exam schedules");
    }
  };

  const resetTimetableForm = () => {
    setTimetableForm({
      branch_id: "",
      semester: 1,
      subject_id: "",
      day_of_week: 1,
      start_time: "",
      end_time: "",
      room_number: "",
      faculty_name: "",
      class_type: "Lecture",
    });
  };

  const resetExamForm = () => {
    setExamForm({
      branch_ids: [],
      semester: 1,
      subject_id: "",
      exam_type: "Mid Sem 1",
      exam_date: "",
      start_time: "",
      end_time: "",
      room_number: "",
      total_marks: 100,
      instructions: "",
    });
  };

  const openEditTimetable = (entry: TimetableEntry) => {
    setEditingItem(entry);
    setTimetableForm({
      branch_id: entry.branch_id,
      semester: entry.semester,
      subject_id: entry.subject_id,
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      room_number: entry.room_number || "",
      faculty_name: entry.faculty_name || "",
      class_type: entry.class_type || "Lecture",
    });
  };

  const openEditExam = (exam: ExamSchedule) => {
    setEditingItem(exam);
    
    // Extract branch IDs from exam_schedule_branches or fall back to branch_id for backward compatibility
    const branchIds = exam.exam_schedule_branches?.map(esb => esb.branch_id) || 
                      (exam.branch_id ? [exam.branch_id] : []);
    
    setExamForm({
      branch_ids: branchIds,
      semester: exam.semester,
      subject_id: exam.subject_id,
      exam_type: exam.exam_type,
      exam_date: exam.exam_date,
      start_time: exam.start_time,
      end_time: exam.end_time,
      room_number: exam.room_number || "",
      total_marks: exam.total_marks || 100,
      instructions: exam.instructions || "",
    });
  };

  const filteredTimetableEntries = timetableEntries.filter((entry) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.subjects?.name.toLowerCase().includes(query) ||
        entry.subjects?.code.toLowerCase().includes(query) ||
        entry.faculty_name?.toLowerCase().includes(query) ||
        entry.room_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredExamSchedules = examSchedules.filter((exam) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        exam.subjects?.name.toLowerCase().includes(query) ||
        exam.subjects?.code.toLowerCase().includes(query) ||
        exam.exam_type.toLowerCase().includes(query) ||
        exam.room_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const hasActiveTabEntries =
    activeTab === "timetable"
      ? filteredTimetableEntries.length > 0
      : filteredExamSchedules.length > 0;

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Timetable & Exams</h1>
            <p className="text-gray-600 mt-1">Manage class schedules and exam timetables</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={activeTab === "timetable" ? handleDeleteAllTimetable : handleDeleteAllExams}
              disabled={!hasActiveTabEntries}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={20} />
              Delete All {activeTab === "timetable" ? "Timetable Entries" : "Exam Schedules"}
            </button>
            <button
              onClick={() => {
                setShowAddModal(true);
                setEditingItem(null);
                if (activeTab === "timetable") {
                  resetTimetableForm();
                } else {
                  resetExamForm();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add {activeTab === "timetable" ? "Timetable Entry" : "Exam Schedule"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab("timetable")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "timetable"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar size={20} />
              Timetable
            </div>
          </button>
          <button
            onClick={() => setActiveTab("exams")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "exams" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarCheck size={20} />
              Exam Schedule
            </div>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSelectedBranch("");
              setSelectedSemester("");
              setSearchQuery("");
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : activeTab === "timetable" ? (
          <TimetableTable
            entries={filteredTimetableEntries}
            onEdit={openEditTimetable}
            onDelete={handleDeleteTimetable}
          />
        ) : (
          <ExamTable schedules={filteredExamSchedules} onEdit={openEditExam} onDelete={handleDeleteExam} />
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || editingItem) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">
                    {editingItem ? "Edit" : "Add"} {activeTab === "timetable" ? "Timetable Entry" : "Exam Schedule"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                {activeTab === "timetable" ? (
                  <TimetableForm
                    form={timetableForm}
                    setForm={setTimetableForm}
                    branches={branches}
                    subjects={subjects}
                    onSubmit={editingItem ? handleUpdateTimetable : handleAddTimetable}
                    onCancel={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                    }}
                  />
                ) : (
                  <ExamForm
                    form={examForm}
                    setForm={setExamForm}
                    branches={branches}
                    subjects={subjects}
                    onSubmit={editingItem ? handleUpdateExam : handleAddExam}
                    onCancel={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Timetable Table Component
function TimetableTable({
  entries,
  onEdit,
  onDelete,
}: {
  entries: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No timetable entries found</h3>
        <p className="text-gray-600">Add your first timetable entry to get started</p>
      </div>
    );
  }

  // Group by day
  const groupedByDay: { [key: number]: TimetableEntry[] } = {};
  entries.forEach((entry) => {
    if (!groupedByDay[entry.day_of_week]) {
      groupedByDay[entry.day_of_week] = [];
    }
    groupedByDay[entry.day_of_week].push(entry);
  });

  return (
    <div className="space-y-6">
      {Object.keys(groupedByDay)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((dayKey) => {
          const day = parseInt(dayKey);
          const dayEntries = groupedByDay[day];
          return (
            <div key={day} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{DAYS[day]}</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              {entry.subjects?.name} ({entry.subjects?.code})
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock size={16} />
                                <span>
                                  {entry.start_time} - {entry.end_time}
                                </span>
                              </div>
                              {entry.room_number && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <MapPin size={16} />
                                  <span>{entry.room_number}</span>
                                </div>
                              )}
                              {entry.faculty_name && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <User size={16} />
                                  <span>{entry.faculty_name}</span>
                                </div>
                              )}
                              {entry.class_type && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <BookOpen size={16} />
                                  <span>{entry.class_type}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-gray-600">
                                <FileText size={16} />
                                <span>
                                  Sem {entry.semester} - {entry.subjects?.branches?.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => onEdit(entry)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

// Exam Table Component
function ExamTable({
  schedules,
  onEdit,
  onDelete,
}: {
  schedules: ExamSchedule[];
  onEdit: (exam: ExamSchedule) => void;
  onDelete: (id: string) => void;
}) {
  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <CalendarCheck className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No exam schedules found</h3>
        <p className="text-gray-600">Add your first exam schedule to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-200">
        {schedules.map((exam) => (
          <div key={exam.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {exam.subjects?.name} ({exam.subjects?.code})
                      </h4>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {exam.exam_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={16} />
                        <span>{new Date(exam.exam_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock size={16} />
                        <span>
                          {exam.start_time} - {exam.end_time}
                        </span>
                      </div>
                      {exam.room_number && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={16} />
                          <span>{exam.room_number}</span>
                        </div>
                      )}
                      {exam.total_marks && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText size={16} />
                          <span>{exam.total_marks} marks</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <BookOpen size={16} />
                        <span>
                          Sem {exam.semester} - 
                          {exam.exam_schedule_branches?.map(esb => esb.branches?.name).filter(Boolean).join(", ") || 
                           exam.subjects?.branches?.name}
                        </span>
                      </div>
                    </div>
                    {exam.instructions && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex gap-2">
                          <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">{exam.instructions}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => onEdit(exam)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => onDelete(exam.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Timetable Form Component
function TimetableForm({
  form,
  setForm,
  branches,
  subjects,
  onSubmit,
  onCancel,
}: {
  form: any;
  setForm: any;
  branches: Branch[];
  subjects: Subject[];
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const filteredSubjects = subjects.filter(
    (s) => s.branch_ids?.includes(form.branch_id) && s.semester === form.semester,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value, subject_id: "" })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
          <select
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value), subject_id: "" })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
        <select
          value={form.subject_id}
          onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
          disabled={!form.branch_id}
        >
          <option value="">Select Subject</option>
          {filteredSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name} ({subject.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week *</label>
          <select
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {DAYS.map((day, index) => (
              <option key={index} value={index}>
                {day}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class Type</label>
          <select
            value={form.class_type}
            onChange={(e) => setForm({ ...form, class_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {CLASS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
          <input
            type="text"
            value={form.room_number}
            onChange={(e) => setForm({ ...form, room_number: e.target.value })}
            placeholder="e.g., Room 101"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Name</label>
          <input
            type="text"
            value={form.faculty_name}
            onChange={(e) => setForm({ ...form, faculty_name: e.target.value })}
            placeholder="e.g., Dr. John Smith"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={!form.branch_id || !form.subject_id || !form.start_time || !form.end_time}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Exam Form Component
function ExamForm({
  form,
  setForm,
  branches,
  subjects,
  onSubmit,
  onCancel,
}: {
  form: any;
  setForm: any;
  branches: Branch[];
  subjects: Subject[];
  onSubmit: () => void;
  onCancel: () => void;
}) {
  // Filter subjects based on selected branches and semester
  const filteredSubjects = subjects.filter(
    (s) => 
      s.semester === form.semester && 
      (form.branch_ids.length === 0 || s.branch_ids?.some(branchId => form.branch_ids.includes(branchId)))
  );

  const handleBranchToggle = (branchId: string) => {
    const newBranchIds = form.branch_ids.includes(branchId)
      ? form.branch_ids.filter((id: string) => id !== branchId)
      : [...form.branch_ids, branchId];
    
    setForm({ ...form, branch_ids: newBranchIds, subject_id: "" });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Branches *</label>
        <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
              <input
                type="checkbox"
                checked={form.branch_ids.includes(branch.id)}
                onChange={() => handleBranchToggle(branch.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm">
                {branch.name} ({branch.code})
              </span>
            </label>
          ))}
        </div>
        {form.branch_ids.length === 0 && (
          <p className="text-xs text-red-500 mt-1">Please select at least one branch</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
        <select
          value={form.semester}
          onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value), subject_id: "" })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <option key={sem} value={sem}>
              Semester {sem}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
        <select
          value={form.subject_id}
          onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
          disabled={form.branch_ids.length === 0}
        >
          <option value="">Select Subject</option>
          {filteredSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name} ({subject.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type *</label>
          <select
            value={form.exam_type}
            onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {EXAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
          <input
            type="number"
            value={form.total_marks}
            onChange={(e) => setForm({ ...form, total_marks: parseInt(e.target.value) })}
            placeholder="e.g., 100"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date *</label>
        <input
          type="date"
          value={form.exam_date}
          onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
        <input
          type="text"
          value={form.room_number}
          onChange={(e) => setForm({ ...form, room_number: e.target.value })}
          placeholder="e.g., Room 101"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
        <textarea
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="Any special instructions for the exam..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={!form.branch_ids.length || !form.subject_id || !form.exam_date || !form.start_time || !form.end_time}
        >
          Save
        </button>
      </div>
    </div>
  );
}
