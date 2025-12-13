import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { ArrowLeft, Code, FileText, ExternalLink, TrendingUp, Target, Clock, Users, Star, Download, Eye, ChevronDown } from "lucide-react-native";

// Updated interfaces for unified schema
interface Topic {
  id: string;
  category_id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Easy" | "Medium" | "Hard";
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes: Resource[];
}

interface Resource {
  id: string;
  category_id: string;
  topic_id: string;
  title: string;
  description: string;
  resource_type: 'note' | 'ai_tool';
  file_url?: string;
  file_type?: string;
  file_size?: string;
  tool_url?: string;
  pricing_type?: string;
  tags: string[];
  thumbnail_url?: string;
  downloads: number;
  views: number;
  rating: number;
  rating_count: number;
  is_featured: boolean;
  is_approved: boolean;
  is_active: boolean;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export default function DSANotes() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTopicsAndNotes();
  }, []);

  const loadTopicsAndNotes = async () => {
    try {
      setLoading(true);

      // Load topics for DSA category using unified schema
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("category_id", "dsa")
        .eq("is_active", true)
        .order("sort_order");

      if (topicsError) throw topicsError;

      // Load notes for each topic using unified resources table
      const topicsWithNotes = await Promise.all(
        (topicsData || []).map(async (topic) => {
          const { data: notesData, error: notesError } = await supabase
            .from("resources")
            .select("*")
            .eq("topic_id", topic.id)
            .eq("resource_type", "note")
            .eq("is_approved", true)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

          if (notesError) {
            console.log("No notes found for topic:", topic.title);
          }

          return {
            ...topic,
            notes: notesData || [],
          };
        }),
      );

      setTopics(topicsWithNotes);
      setExpandedTopics((prev) => {
        const next = { ...prev };
        topicsWithNotes.forEach((topic) => {
          if (next[topic.id] === undefined) {
            next[topic.id] = false;
          }
        });
        // Remove any topics that no longer exist
        Object.keys(next).forEach((key) => {
          if (!topicsWithNotes.find((topic) => topic.id === key)) {
            delete next[key];
          }
        });
        return next;
      });
    } catch (error) {
      console.log("Could not load DSA content - may be empty or permission restricted");
      // Don't show alert for empty data - just show empty state
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTopicsAndNotes();
    setRefreshing(false);
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  const handleDownload = async (note: Resource) => {
    try {
      if (note.file_url) {
        // Update download count
        await supabase
          .from("resources")
          .update({ downloads: (note.downloads || 0) + 1 })
          .eq("id", note.id);

        // Open the file URL
        const { Linking } = require("react-native");
        await Linking.openURL(note.file_url);
        
        // Refresh data to show updated download count
        loadTopicsAndNotes();
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      Alert.alert("Error", "Failed to download file. Please try again.");
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "#10B981"; // Green
      case "Easy":
        return "#3B82F6"; // Blue
      case "Medium":
        return "#F59E0B"; // Yellow
      case "Hard":
        return "#EF4444"; // Red
      default:
        return "#6B7280"; // Gray
    }
  };

  const formatFileSize = (size?: string) => {
    return size || "Unknown size";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading DSA resources...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Code size={28} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Data Structures & Algorithms</Text>
            <Text style={styles.headerSubtitle}>{topics.length} topics available</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {topics.map((topic) => (
          <View key={topic.id} style={styles.topicCard}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleTopic(topic.id)}
              style={styles.topicHeader}
            >
              <View style={styles.topicInfo}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.topicDescription}>{topic.description}</Text>
                <Text style={styles.resourceCount}>{topic.notes.length} resources</Text>
              </View>
              <View style={styles.topicHeaderRight}>
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(topic.difficulty) }]}>
                  <Text style={styles.difficultyText}>{topic.difficulty}</Text>
                </View>
                <ChevronDown
                  size={18}
                  color="#6B7280"
                  style={expandedTopics[topic.id] ? styles.chevronExpanded : styles.chevronCollapsed}
                />
              </View>
            </TouchableOpacity>

            {expandedTopics[topic.id] && (
              <>
                <View style={styles.topicStats}>
                  <View style={styles.statItem}>
                    <FileText size={16} color="#6B7280" />
                    <Text style={styles.statText}>{topic.notes.length} notes</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Download size={16} color="#6B7280" />
                    <Text style={styles.statText}>
                      {topic.notes.reduce((sum, note) => sum + (note.downloads || 0), 0)} downloads
                    </Text>
                  </View>
                </View>

                {topic.notes.length > 0 ? (
                  <View style={styles.notesContainer}>
                    {topic.notes.map((note) => (
                      <TouchableOpacity
                        key={note.id}
                        style={styles.noteCard}
                        onPress={() => handleDownload(note)}
                      >
                        <View style={styles.noteHeader}>
                          <View style={styles.noteInfo}>
                            <Text style={styles.noteTitle}>{note.title}</Text>
                            <Text style={styles.noteDescription} numberOfLines={2}>
                              {note.description}
                            </Text>
                          </View>
                          {note.is_featured && (
                            <View style={styles.featuredBadge}>
                              <Star size={12} color="#F59E0B" />
                            </View>
                          )}
                        </View>

                        <View style={styles.noteDetails}>
                          <View style={styles.noteMetadata}>
                            <Text style={styles.fileType}>{note.file_type?.toUpperCase()}</Text>
                            <Text style={styles.fileSize}>{formatFileSize(note.file_size)}</Text>
                          </View>
                          <View style={styles.noteStats}>
                            <View style={styles.statItem}>
                              <Download size={14} color="#6B7280" />
                              <Text style={styles.statValue}>{note.downloads}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Eye size={14} color="#6B7280" />
                              <Text style={styles.statValue}>{note.views}</Text>
                            </View>
                            {note.rating > 0 && (
                              <View style={styles.statItem}>
                                <Star size={14} color="#F59E0B" />
                                <Text style={styles.statValue}>{note.rating.toFixed(1)}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {note.tags && note.tags.length > 0 && (
                          <View style={styles.tagsContainer}>
                            {note.tags.slice(0, 3).map((tag, index) => (
                              <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                              </View>
                            ))}
                            {note.tags.length > 3 && (
                              <Text style={styles.moreTagsText}>+{note.tags.length - 3} more</Text>
                            )}
                          </View>
                        )}

                        <View style={styles.downloadButton}>
                          <ExternalLink size={16} color="#3B82F6" />
                          <Text style={styles.downloadButtonText}>Download</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <FileText size={48} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>No notes available for this topic</Text>
                  </View>
                )}
              </>
            )}
          </View>
        ))}

        {topics.length === 0 && (
          <View style={styles.emptyState}>
            <Code size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No DSA Topics Found</Text>
            <Text style={styles.emptyStateText}>Check back later for new content</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EBF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  topicCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topicHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  topicInfo: {
    flex: 1,
    marginRight: 12,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  resourceCount: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
  },
  topicHeaderRight: {
    alignItems: "flex-end",
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  topicStats: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 4,
  },
  statValue: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  notesContainer: {
    gap: 12,
  },
  noteCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  noteInfo: {
    flex: 1,
    marginRight: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  noteDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 18,
  },
  featuredBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  noteDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteMetadata: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileType: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
    backgroundColor: "#EBF4FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  fileSize: {
    fontSize: 12,
    color: "#6B7280",
  },
  noteStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  tag: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: "#374151",
  },
  moreTagsText: {
    fontSize: 10,
    color: "#6B7280",
    alignSelf: "center",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBF4FF",
    paddingVertical: 8,
    borderRadius: 6,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 4,
  },
  chevronCollapsed: {
    marginTop: 8,
  },
  chevronExpanded: {
    marginTop: 8,
    transform: [{ rotate: "180deg" }],
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
