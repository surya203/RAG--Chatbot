import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  Crown,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Mic,
  PenLine,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

export type StudentNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export type StudentNavGroup = {
  title: string;
  items: StudentNavItem[];
};

export const STUDENT_NAV: StudentNavGroup[] = [
  {
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
      { to: "/chat", label: "PDF Chat", icon: MessageSquare },
    ],
  },
  {
    title: "Exam practice",
    items: [
      { to: "/exam-profile", label: "Exam profile", icon: Target },
      { to: "/writing", label: "Writing Coach", icon: PenLine },
      { to: "/speaking", label: "Speaking Coach", icon: Mic },
      { to: "/reading", label: "Reading Practice", icon: BookOpen },
      { to: "/listening", label: "Listening Practice", icon: Headphones },
      { to: "/vocab", label: "Vocabulary SRS", icon: BookMarked },
      { to: "/mocks", label: "Mock Exams", icon: ClipboardList },
      { to: "/progress", label: "Progress", icon: TrendingUp },
    ],
  },
];

export const LEADERBOARD_NAV = {
  label: "Leaderboard",
  icon: Trophy,
};

export const APP_BRAND = {
  title: "Exam Coach",
  subtitle: "AI exam preparation",
  icon: Crown,
};
