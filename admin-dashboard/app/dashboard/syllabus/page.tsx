"use client";

import { useEffect, useMemo, useState } from "react";
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
  Link as LinkIcon,
} from "lucide-react";

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface SyllabusDocument {
  id: string;
  title: string;
  description?: string;
  semester: number;
  file_url: string;
  file_type?: string;
  is_verified: boolean;
  download_count: number;
  tags?: string[] | null;
  created_at: string;
  syllabus_document_branches?: {
    branch_id: string;
    branches?: {
      id: string;
      name: string;
      code: string;
    };
  }[];
}

interface SyllabusFormData {
  title: string;
  description: string;
  semester: string;
  branch_ids: string[];
  google_drive_link: string;
  file_type: string;
  tags: string;
  is_verified: boolean;
}

const FILE_TYPES = ["PDF", "DOC", "PPT", "XLS", "TXT", "Other"] as const;

type FileType = (typeof FILE_TYPES)[number];

export default function SyllabusPage() {
  const [syllabusDocs, setSyllabusDocs] = useState<SyllabusDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SyllabusDocument | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  const defaultFormData: SyllabusFormData = {
    title: "",
    description: "",
    semester: "",
    branch_ids: [],
    google_drive_link: "",
    file_type: "PDF",
    tags: "",
    is_verified: true,
  };

  const [formData, setFormData] = useState<SyllabusFormData>(defaultFormData);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadSyllabusDocs();
  }, [filterVerified]);

  async function loadBranches() {
    try {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error("Error loading branches:", error);
      alert("Failed to load branches. Please refresh the page.");
    }
  }

  async function loadSyllabusDocs() {
    setLoading(true);
    try {
      let query = supabase
        .from("syllabus_documents")
        .select(
          `
          *,
          syllabus_document_branches (
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

      const { data, error } = await query;
      if (error) throw error;
      setSyllabusDocs((data as SyllabusDocument[]) || []);
    } catch (error) {
      console.error("Error loading syllabus documents:", error);
      alert("Failed to load syllabus documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return syllabusDocs;

    const term = searchTerm.toLowerCase();
    return syllabusDocs.filter((doc) => {
      const branchCodes = doc.syllabus_document_branches?.map((item) => item.branches?.code || "").join(" ") || "";
      const tagString = doc.tags?.join(" ") || "";

      return [doc.title, doc.description, branchCodes, tagString, `semester ${doc.semester}`]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [syllabusDocs, searchTerm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.semester || !formData.google_drive_link || formData.branch_ids.length === 0) {
      alert("Please complete all required fields.");
      return;
    }

    if (!formData.google_drive_link.includes("drive.google.com")) {
      alert("Please provide a valid Google Drive link.");
      return;
    }

    const parsedSemester = parseInt(formData.semester, 10);
    if (Number.isNaN(parsedSemester)) {
      alert("Semester must be a number.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        semester: parsedSemester,
        file_url: formData.google_drive_link,
        file_type: formData.file_type as FileType,
        is_verified: formData.is_verified,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      };

      let docId: string;

      if (editingDoc) {
        const { error } = await supabase.from("syllabus_documents").update(payload).eq("id", editingDoc.id);
        if (error) throw error;
        docId = editingDoc.id;

        const { error: deleteError } = await supabase
          .from("syllabus_document_branches")
          .delete()
          .eq("syllabus_document_id", docId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase.from("syllabus_documents").insert(payload).select().single();
        if (error || !data) throw error || new Error("Failed to create syllabus document");
        docId = data.id;
      }

      const branchAssociations = formData.branch_ids.map((branchId) => ({
        syllabus_document_id: docId,
        branch_id: branchId,
      }));

      if (branchAssociations.length > 0) {
        const { error: branchError } = await supabase.from("syllabus_document_branches").insert(branchAssociations);
        if (branchError) throw branchError;
      }

      alert(editingDoc ? "Syllabus updated successfully!" : "Syllabus added successfully!");
      closeModal();
      await loadSyllabusDocs();
    } catch (error: any) {
      console.error("Error saving syllabus document:", error);
      alert("Failed to save syllabus document: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVerification(docId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from("syllabus_documents")
        .update({ is_verified: !currentStatus })
        .eq("id", docId);
      if (error) throw error;
      await loadSyllabusDocs();
    } catch (error) {
      console.error("Error updating verification status:", error);
      alert("Failed to update verification status.");
    }
  }

  async function deleteDoc(docId: string) {
    if (!confirm("Are you sure you want to delete this syllabus document?")) return;

    try {
      const { error } = await supabase.from("syllabus_documents").delete().eq("id", docId);
      if (error) throw error;
      await loadSyllabusDocs();
    } catch (error) {
      console.error("Error deleting syllabus document:", error);
      alert("Failed to delete syllabus document.");
    }
  }

  function openCreateModal() {
    setEditingDoc(null);
    setFormData(defaultFormData);
    setShowModal(true);
  }

  function openEditModal(doc: SyllabusDocument) {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      description: doc.description || "",
      semester: doc.semester.toString(),
      branch_ids: doc.syllabus_document_branches?.map((row) => row.branch_id) || [],
      google_drive_link: doc.file_url,
      file_type: doc.file_type || "PDF",
      tags: doc.tags?.join(", ") || "",
      is_verified: doc.is_verified,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingDoc(null);
    setFormData(defaultFormData);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Syllabus Management</h1>
            <p className="text-sm text-gray-600 mt-1">Create, verify, and manage syllabus documents.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Syllabus</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Documents</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{syllabusDocs.length}</p>
              </div>
              <Download className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Verified</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{syllabusDocs.filter((p) => p.is_verified).length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Unverified</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{syllabusDocs.filter((p) => !p.is_verified).length}</p>
              </div>
              <Filter className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Downloads</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {syllabusDocs.reduce((sum, doc) => sum + (doc.download_count || 0), 0)}
                </p>
              </div>
              <Download className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, description, branch, or tag..."
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
                <option value="all">All Docs</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branches</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downloads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading syllabus documents...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No syllabus documents found.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{doc.title}</p>
                        {doc.description && <p className="text-xs text-gray-500 line-clamp-1">{doc.description}</p>}
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">Semester {doc.semester}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {doc.syllabus_document_branches && doc.syllabus_document_branches.length > 0 ? (
                          doc.syllabus_document_branches.map((branch) => (
                            <span
                              key={branch.branch_id}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700"
                            >
                              {branch.branches?.code || "N/A"}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No branches</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          doc.is_verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {doc.is_verified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{doc.download_count || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleVerification(doc.id, doc.is_verified)}
                          className={`p-1.5 rounded hover:bg-gray-100 ${
                            doc.is_verified ? "text-amber-600" : "text-green-600"
                          }`}
                          title={doc.is_verified ? "Mark as pending" : "Mark as verified"}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Open in Google Drive"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openEditModal(doc)}
                          className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                          title="Edit"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteDoc(doc.id)}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingDoc ? "Edit Syllabus" : "Add Syllabus"}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                    placeholder="e.g., Semester 4 Computer Science Syllabus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Brief details about the syllabus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Applicable Branches * (select one or more)
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
                              });
                            } else {
                              setFormData({
                                ...formData,
                                branch_ids: formData.branch_ids.filter((id) => id !== branch.id),
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {branch.code} • {branch.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, branch_ids: branches.map((b) => b.id) })}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-gray-400">|</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, branch_ids: [] })}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear All
                    </button>
                    <span className="ml-auto text-xs text-gray-600">{formData.branch_ids.length} selected</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
                    <select
                      required
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                    <select
                      value={formData.file_type}
                      onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {FILE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <p className="text-xs text-gray-500 mt-1">Ensure the link has appropriate sharing permissions.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., cse, semester-4"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="is_verified"
                    type="checkbox"
                    checked={formData.is_verified}
                    onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_verified" className="text-sm font-medium text-gray-700">
                    Mark as verified
                  </label>
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
                      <span>{editingDoc ? "Update Syllabus" : "Add Syllabus"}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
