"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  X,
  Loader2,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

const MATERIAL_CATEGORIES = [
  { value: "notes", label: "Notes" },
  { value: "books", label: "Books" },
  { value: "practicals", label: "Practical Files" },
  { value: "assignments", label: "Assignments" },
  { value: "other", label: "Other Material" },
] as const;

type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]["value"];

type NoteFormData = {
  title: string;
  description: string;
  subject_id: string;
  branch_ids: string[];
  semester: string;
  tags: string;
  google_drive_link: string;
  file_type: string;
  material_category: MaterialCategory;
};

interface Note {
  id: string;
  title: string;
  description?: string;
  subject_id: string;
  file_url: string;
  file_type?: string;
  is_verified: boolean;
  download_count: number;
  tags?: string[];
  material_category?: MaterialCategory | null;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    semester: number;
  };
  note_branches?: {
    branch_id: string;
    branches?: {
      id: string;
      name: string;
      code: string;
    };
  }[];
}

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
  branch_id: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVerified, setFilterVerified] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const defaultFormData: NoteFormData = {
    title: "",
    description: "",
    subject_id: "",
    branch_ids: [],
    semester: "",
    tags: "",
    google_drive_link: "",
    file_type: "PDF",
    material_category: MATERIAL_CATEGORIES[0].value,
  };

  // Form state
  const [formData, setFormData] = useState<NoteFormData>(defaultFormData);

  useEffect(() => {
    loadData();
  }, [filterVerified]);

  useEffect(() => {
    if (formData.branch_ids.length > 0 && formData.semester) {
      loadSubjects(formData.branch_ids[0], parseInt(formData.semester));
    }
  }, [formData.branch_ids, formData.semester]);

  async function loadData() {
    setLoading(true);
    try {
      // Load branches
      const { data: branchesData } = await supabase.from("branches").select("*").order("name");
      setBranches(branchesData || []);

      // Load notes with branch associations
      let query = supabase
        .from("notes")
        .select(
          `
          *,
          subjects (
            id,
            name,
            code,
            semester
          ),
          note_branches (
            branch_id,
            branches (
              id,
              name,
              code
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (filterVerified === "verified") {
        query = query.eq("is_verified", true);
      } else if (filterVerified === "unverified") {
        query = query.eq("is_verified", false);
      }

      const { data: notesData, error } = await query;
      if (error) throw error;
      
      console.log("Loaded notes data:", notesData);
      console.log("Notes with branch associations:", notesData?.map(note => ({
        id: note.id,
        title: note.title,
        subject: note.subjects?.name,
        branches: note.note_branches?.map((nb: any) => nb.branches?.code)
      })));
      
      setNotes(notesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjects(branchId: string, semester: number) {
    try {
      console.log("Loading subjects for branch:", branchId, "semester:", semester);
      
      // Query subjects using the subject_branches table for many-to-many relationships
      // We need to join subjects table properly through the junction table
      const { data, error } = await supabase
        .from("subjects")
        .select(
          `
          *,
          subject_branches!inner (
            branch_id
          )
        `,
        )
        .eq("subject_branches.branch_id", branchId)
        .eq("semester", semester)
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Primary query error:", error);
        
        // Try alternative query approach
        console.log("Trying alternative query approach...");
        const { data: altData, error: altError } = await supabase
          .from("subject_branches")
          .select(
            `
            subjects (
              id,
              name,
              code,
              semester,
              credits,
              syllabus_url,
              description,
              is_active
            )
          `,
          )
          .eq("branch_id", branchId)
          .eq("subjects.semester", semester)
          .eq("subjects.is_active", true);

        if (altError) {
          console.error("Alternative query error:", altError);
          setSubjects([]);
          return;
        }

        if (altData && altData.length > 0) {
          console.log("Alternative query data:", altData);
          const mappedSubjects = altData
            .map((item: any) => item.subjects)
            .filter((s: any): s is Subject => s !== null && typeof s === 'object' && !Array.isArray(s));
          console.log("Mapped subjects from alternative query:", mappedSubjects);
          setSubjects(mappedSubjects);
          return;
        }
      }

      if (data && data.length > 0) {
        console.log("Primary query successful, subjects found:", data);
        setSubjects(data);
        return;
      }

      console.log("No subjects found for the given criteria");
      setSubjects([]);
    } catch (error) {
      console.error("Error loading subjects:", error);
      setSubjects([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.google_drive_link || !formData.subject_id) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate at least one branch is selected
    if (formData.branch_ids.length === 0) {
      alert("Please select at least one branch");
      return;
    }

    // Validate Google Drive link
    if (!formData.google_drive_link.includes("drive.google.com")) {
      alert("Please provide a valid Google Drive link");
      return;
    }

    if (!formData.material_category) {
      alert("Please select a material type");
      return;
    }

    try {
      const noteData = {
        title: formData.title,
        description: formData.description,
        subject_id: formData.subject_id,
        file_url: formData.google_drive_link,
        file_type: formData.file_type,
        is_verified: true,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
        material_category: formData.material_category,
      };

      let noteId: string;

      if (editingNote) {
        // Update existing note

        const { error } = await supabase.from("notes").update(noteData).eq("id", editingNote.id);

        if (error) throw error;

        noteId = editingNote.id;

        // Delete existing branch associations

        await supabase.from("note_branches").delete().eq("note_id", noteId);
      } else {
        // Create new note

        const { data, error } = await supabase.from("notes").insert(noteData).select().single();

        if (error) throw error;

        noteId = data.id;
      }

      // Fetch all branches associated with the selected subject
      const { data: subjectBranches, error: subjectBranchesError } = await supabase
        .from("subject_branches")
        .select("branch_id")
        .eq("subject_id", formData.subject_id);

      if (subjectBranchesError) {
        console.error("Error fetching subject branches:", subjectBranchesError);
        throw new Error(`Failed to fetch subject branches: ${subjectBranchesError.message}`);
      }

      const branchAssociations = (subjectBranches || []).map((branch) => ({
        note_id: noteId,

        branch_id: branch.branch_id,
      }));

      const { error: branchError } = await supabase.from("note_branches").insert(branchAssociations);

      if (branchError) {
        console.error("Branch association error:", branchError);

        throw new Error(`Failed to create branch associations: ${branchError.message}`);
      }

      alert(editingNote ? "Note updated successfully!" : "Note added successfully!");

      setShowModal(false);

      resetForm();

      loadData();
    } catch (error: any) {
      console.error("Error saving note:", error);

      alert("Error saving note: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVerification(noteId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase.from("notes").update({ is_verified: !currentStatus }).eq("id", noteId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error updating note:", error);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  }

  async function openEditModal(note: Note) {
    setEditingNote(note);

    // Fetch branch associations for this note
    const { data: noteBranches, error: noteBranchesError } = await supabase
      .from("note_branches")
      .select("branch_id")
      .eq("note_id", note.id);

    if (noteBranchesError) {
      console.error("Error fetching note branches:", noteBranchesError);
    }

    const branchIds = noteBranches?.map((nb) => nb.branch_id) || [];
    console.log("Note branches for editing:", branchIds);

    setFormData({
      title: note.title,
      description: note.description || "",
      subject_id: note.subject_id,
      branch_ids: branchIds,
      semester: note.subjects?.semester.toString() || "",
      tags: note.tags?.join(", ") || "",
      google_drive_link: note.file_url,
      file_type: note.file_type || "PDF",
      material_category: (note.material_category as MaterialCategory | null) ?? MATERIAL_CATEGORIES[0].value,
    });
    setShowModal(true);
  }

  function resetForm() {
    setEditingNote(null);
    setFormData(defaultFormData);
  }

  function extractGoogleDriveId(url: string): string | null {
    const patterns = [/\/file\/d\/([^\/]+)/, /id=([^&]+)/, /\/d\/([^\/]+)/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function getDirectDownloadLink(url: string): string {
    const fileId = extractGoogleDriveId(url);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  }

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.subjects?.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notes Management</h1>
            <p className="text-sm text-gray-600 mt-1">Add and manage study materials with Google Drive links</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Note</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Notes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{notes.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Verified</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{notes.filter((n) => n.is_verified).length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{notes.filter((n) => !n.is_verified).length}</p>
              </div>
              <FileText className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Downloads</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {notes.reduce((sum, n) => sum + (n.download_count || 0), 0)}
                </p>
              </div>
              <Download className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterVerified}
                onChange={(e) => setFilterVerified(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Notes</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch/Sem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downloads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading notes...
                  </td>
                </tr>
              ) : filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No notes found
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{note.title}</p>
                        {note.description && <p className="text-xs text-gray-500 line-clamp-1">{note.description}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{note.subjects?.name || "N/A"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {note.note_branches && note.note_branches.length > 0 ? (
                          note.note_branches.map((nb: any) => (
                            <span
                              key={nb.branch_id}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700"
                            >
                              {nb.branches?.code || "N/A"}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No branches</span>
                        )}
                        <span className="text-xs text-gray-500 ml-auto">Sem {note.subjects?.semester || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {note.material_category
                          ? MATERIAL_CATEGORIES.find((cat) => cat.value === note.material_category)?.label || "Study Material"
                          : "Study Material"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {note.file_type || "PDF"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          note.is_verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {note.is_verified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{note.download_count || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleVerification(note.id, note.is_verified)}
                          className={`p-1.5 rounded hover:bg-gray-100 ${
                            note.is_verified ? "text-amber-600" : "text-green-600"
                          }`}
                          title={note.is_verified ? "Unverify" : "Verify"}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <a
                          href={note.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="View on Google Drive"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openEditModal(note)}
                          className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                          title="Edit"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingNote ? "Edit Note" : "Add New Note"}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Unit 3 - Data Structures"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Brief description of the content..."
                />
              </div>

              {/* Multi-Branch Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable Branches * (Select one or more)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border border-gray-300 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center space-x-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.branch_ids.includes(branch.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              branch_ids: [...formData.branch_ids, branch.id],
                              subject_id: "",
                            });
                          } else {
                            setFormData({
                              ...formData,
                              branch_ids: formData.branch_ids.filter((id) => id !== branch.id),
                              subject_id: "",
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {branch.code} - {branch.name}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, branch_ids: branches.map((b) => b.id), subject_id: "" })}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, branch_ids: [], subject_id: "" })}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear All
                  </button>
                  <span className="ml-auto text-xs text-gray-600">{formData.branch_ids.length} selected</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
                  <select
                    required
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value, subject_id: "" })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Semester</option>
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
                  required
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  disabled={formData.branch_ids.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive Link *</label>
                <input
                  type="url"
                  required
                  value={formData.google_drive_link}
                  onChange={(e) => setFormData({ ...formData, google_drive_link: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://drive.google.com/file/d/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Make sure the Google Drive file is set to "Anyone with the link can view"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                <select
                  value={formData.file_type}
                  onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="PDF">PDF</option>
                  <option value="DOC">DOC/DOCX</option>
                  <option value="PPT">PPT/PPTX</option>
                  <option value="XLS">XLS/XLSX</option>
                  <option value="TXT">TXT</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type *</label>
                <select
                  required
                  value={formData.material_category}
                  onChange={(e) => setFormData({ ...formData, material_category: e.target.value as MaterialCategory })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {MATERIAL_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., important, midterm, theory"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingNote ? "Update Note" : "Add Note"}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
