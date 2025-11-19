"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { 
  Mail, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Shield, 
  Crown, 
  Heart,
  Code,
  Database,
  Smartphone,
  Globe,
  MessageCircle,
  ExternalLink,
  Phone,
  Sparkles,
  Loader2
} from "lucide-react";

interface OwnerContact {
  name: string;
  email: string;
  created_at: string;
}

interface AppStats {
  totalUsers: number;
  totalSubjects: number;
  totalNotes: number;
  totalBranches: number;
}

export default function AboutPage() {
  const [owners, setOwners] = useState<OwnerContact[]>([]);
  const [stats, setStats] = useState<AppStats>({
    totalUsers: 0,
    totalSubjects: 0,
    totalNotes: 0,
    totalBranches: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load owner contacts
      const { data: ownerData } = await supabase.rpc("get_owner_contacts");
      if (ownerData) {
        setOwners(ownerData);
      }

      // Load app statistics
      const [usersResult, subjectsResult, notesResult, branchesResult] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true })
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalSubjects: subjectsResult.count || 0,
        totalNotes: notesResult.count || 0,
        totalBranches: branchesResult.count || 0
      });
    } catch (error) {
      console.error("Error loading about data:", error);
    } finally {
      setLoading(false);
    }
  }

  const features = [
    {
      icon: <BookOpen className="w-5 h-5 text-blue-500" />,
      title: "Unified Notes Cloud",
      description: "Upload, curate, and deliver notes, books, assignments, and PYQs from a single source of truth."
    },
    {
      icon: <Users className="w-5 h-5 text-purple-500" />,
      title: "Role-Aware Governance",
      description: "Granular permissions keep owners, admins, and students aligned without compromising control."
    },
    {
      icon: <GraduationCap className="w-5 h-5 text-emerald-500" />,
      title: "Academic Intelligence",
      description: "Branch, semester, and subject mapping ensure every learner sees the right resources instantly."
    },
    {
      icon: <Smartphone className="w-5 h-5 text-pink-500" />,
      title: "Mobile-First Access",
      description: "Expo powered mobile experience keeps the community connected on the go with parity to the web."
    },
    {
      icon: <Database className="w-5 h-5 text-indigo-500" />,
      title: "Supabase Reliability",
      description: "PostgreSQL + Row Level Security guardrails power dependable data operations and file delivery."
    },
    {
      icon: <Globe className="w-5 h-5 text-amber-500" />,
      title: "Modern Admin Dashboard",
      description: "Next.js 14, TypeScript, and Tailwind compose a high-velocity dashboard for rapid decision making."
    }
  ];

  const techStack = [
    { name: "Frontend", tech: "Next.js 14, React Server Components, TypeScript, Tailwind CSS" },
    { name: "Backend", tech: "Supabase, PostgreSQL, Edge Functions, Row Level Security" },
    { name: "Mobile", tech: "React Native, Expo Router, NativeWind" },
    { name: "Authentication", tech: "Supabase Auth, Magic Links, JWT Session Management" },
    { name: "Storage", tech: "Supabase Storage, CDN-backed delivery, Access Policies" },
    { name: "CI/CD", tech: "Vercel (Web), Expo EAS (Mobile), GitHub Actions" }
  ];

  const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

  const statCards = [
    {
      title: "Active Users",
      value: formatNumber(stats.totalUsers),
      description: "Admins and learners collaborating each month",
      icon: <Users className="w-5 h-5 text-blue-600" />,
      gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
      border: "border-blue-200/60"
    },
    {
      title: "Subjects Curated",
      value: formatNumber(stats.totalSubjects),
      description: "Structured across every branch-semester combination",
      icon: <BookOpen className="w-5 h-5 text-green-600" />,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      border: "border-emerald-200/60"
    },
    {
      title: "Resources Hosted",
      value: formatNumber(stats.totalNotes),
      description: "Notes, PYQs, practical files, books, and more",
      icon: <Database className="w-5 h-5 text-purple-600" />,
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      border: "border-purple-200/60"
    },
    {
      title: "Branches Supported",
      value: formatNumber(stats.totalBranches),
      description: "Engineering disciplines with localized content",
      icon: <GraduationCap className="w-5 h-5 text-orange-500" />,
      gradient: "from-orange-500/10 via-orange-500/5 to-transparent",
      border: "border-orange-200/60"
    }
  ];

  const pillars = [
    {
      title: "Operational Excellence",
      description: "Standardized workflows keep uploads, verification, and publishing predictable across teams.",
      bullets: [
        "Supabase powered automations for CRUD operations",
        "Verification queues with instant rollbacks",
        "Role gated actions that prevent accidental overrides"
      ]
    },
    {
      title: "Student Experience",
      description: "Everything is centered around helping learners reach the right syllabus content instantly.",
      bullets: [
        "Smart filters by branch, semester, and subject",
        "Mobile offline-ready downloads for critical notes",
        "Personalized dashboards and visual progress cues"
      ]
    },
    {
      title: "Future-Proof Architecture",
      description: "We continuously ship refinements that keep the platform ready for the next cohort.",
      bullets: [
        "Modular dashboards for new resource types",
        "Scalable Supabase migrations with roll forward scripts",
        "CI pipelines that safeguard database and UI changes"
      ]
    }
  ];

  

  return (
    <DashboardLayout>
      <div className="space-y-12 pb-16">
        <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-blue-600 text-white shadow-xl">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25) 0, transparent 55%)"
            }}
          />
          <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-10 px-8 py-12 md:grid-cols-[1.4fr,1fr] md:px-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Built for the HBTU learning community
              </div>
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                College Study Platform
                <span className="mt-3 block text-base font-normal text-white/80 md:text-lg">
                  A modern academic OS for managing every branch, subject, and resource from a single dashboard.
                </span>
              </h1>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Why it matters</p>
                  <p className="mt-2 text-sm text-white/90">
                    Streamlined workflows help owners and admins curate syllabus-aligned content that students can trust.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Today&apos;s focus</p>
                  <ul className="mt-2 space-y-1 text-sm text-white/90">
                    <li>• Keep branches & semesters in sync</li>
                    <li>• Verify resources before publish</li>
                    <li>• Track engagement across cohorts</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-10 w-10 text-white" />
                <div>
                  <p className="text-sm uppercase tracking-wide text-white/80">Snapshot</p>
                  <p className="text-xl font-semibold">Academic Health</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 text-white/90">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Users onboarded</span>
                  <span className="text-lg font-semibold">{loading ? "-" : formatNumber(stats.totalUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Subjects mapped</span>
                  <span className="text-lg font-semibold">{loading ? "-" : formatNumber(stats.totalSubjects)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Resources live</span>
                  <span className="text-lg font-semibold">{loading ? "-" : formatNumber(stats.totalNotes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Branches covered</span>
                  <span className="text-lg font-semibold">{loading ? "-" : formatNumber(stats.totalBranches)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Platform pulse</h2>
              <p className="text-sm text-gray-600">Live metrics pulled directly from Supabase to highlight adoption.</p>
            </div>
          </div>
          {loading ? (
            <div className="mt-6 flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-3 text-sm text-gray-500">Crunching numbers...</span>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.title}
                  className={`relative overflow-hidden rounded-2xl border ${card.border} bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-white/80 p-2 shadow-sm">
                          {card.icon}
                        </div>
                        <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-gray-900">{card.value}</p>
                      <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm lg:grid-cols-[0.85fr,1.15fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-red-500" />
              <h2 className="text-2xl font-semibold text-gray-900">What you can orchestrate</h2>
            </div>
            <p className="text-sm text-gray-600">
              The dashboard keeps every stakeholder in flow—from creating syllabus-driven resources to verifying them for students.
              Each capability below is optimized for quick actions and clarity.
            </p>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Stack highlights</p>
              <p className="mt-2 text-sm text-gray-700">
                Built on modern Next.js and Supabase primitives so performance, security, and developer velocity stay on track.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-gray-100 bg-gray-50 p-5 transition hover:border-blue-300 hover:bg-white hover:shadow-md"
              >
                <div className="mb-3 inline-flex items-center gap-3 rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
                  {feature.icon}
                  {feature.title}
                </div>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900">Operating pillars</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{pillar.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{pillar.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {pillar.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        

        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <Code className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900">Technology stack</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            A carefully curated set of tools keeps deployments smooth and enables rapid experimentation without sacrificing reliability.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {techStack.map((item) => (
              <div key={item.name} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">{item.name}</p>
                <p className="mt-2 text-sm text-gray-700">{item.tech}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-green-600" />
              <h2 className="text-2xl font-semibold text-gray-900">Leadership & support channel</h2>
            </div>
            <p className="text-sm text-gray-600">
              Owners handle subject provisioning, branch rollouts, and escalations. Reach out with detailed context so we can respond fast.
            </p>
            <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
              <p className="text-xs uppercase tracking-wide text-green-600">For admins to add a new Branch/Subject Or any other query</p>
              <p className="mt-2 text-sm text-green-800">
                Keep your message detailed—include subject code, semester, credit load, and the branches that need access. This helps us keep the
                database consistent and avoid rework.
              </p>
            </div>
          </div>

          

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Priyal Kumar</h3>
                  <p className="text-sm text-blue-700">Founder • HBTU CSE&apos;27</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-blue-900">
                <a
                  href="mailto:priyalkumar06@gmail.com"
                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 transition hover:border-blue-300"
                >
                  <Mail className="h-4 w-4" />
                  priyalkumar06@gmail.com
                </a>
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2">
                  <Phone className="h-4 w-4" />
                  +91 89572 21543
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-100 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-purple-900">Ravi Pratap Singh</h3>
                  <p className="text-sm text-purple-700">Co-founder • HBTU CSE&apos;27</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-purple-900">
                <a
                  href="mailto:ravixalgorithm@gmail.com"
                  className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2 transition hover:border-purple-300"
                >
                  <Mail className="h-4 w-4" />
                  ravixalgorithm@gmail.com
                </a>
                <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2">
                  <Phone className="h-4 w-4" />
                  +91 86301 01565
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
          Built with ❤️ for educational excellence • Secure • Scalable • Student-focused • Always improving with your feedback
        </section>
      </div>
    </DashboardLayout>
  );
}
