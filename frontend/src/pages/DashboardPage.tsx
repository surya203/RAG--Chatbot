import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, BookOpen, ClipboardList, Headphones, Loader2, LogOut, MessageSquare, Mic, PenLine, Target, TrendingUp, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import DocumentList from "@/components/DocumentList";
import LeaderboardModal from "@/components/LeaderboardModal";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import QuizModal from "@/components/QuizModal";
import SummaryModal from "@/components/SummaryModal";
import UploadPanel from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { listDocuments } from "@/services/documents";
import type { Document } from "@/types/document";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [summaryDoc, setSummaryDoc] = useState<Document | null>(null);
  const [quizDoc, setQuizDoc] = useState<Document | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
    // Poll while any document is still being ingested so status badges update.
    refetchInterval: (query) => {
      const docs = query.state.data;
      const processing = docs?.some(
        (d) => d.status === "pending" || d.status === "processing"
      );
      return processing ? 2500 : false;
    },
  });

  const subjects = useMemo(() => {
    const set = new Set((documents ?? []).map((d) => d.subject));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const readyCount = useMemo(
    () => (documents ?? []).filter((d) => d.status === "ready").length,
    [documents]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">RAG Chatbot</h1>
            <p className="text-[var(--color-muted-foreground)]">
              Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/exam-profile">
                <Target className="h-4 w-4" />
                Exam profile
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/writing">
                <PenLine className="h-4 w-4" />
                Writing Coach
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/speaking">
                <Mic className="h-4 w-4" />
                Speaking Coach
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/reading">
                <BookOpen className="h-4 w-4" />
                Reading Practice
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/listening">
                <Headphones className="h-4 w-4" />
                Listening Practice
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/vocab">
                <BookMarked className="h-4 w-4" />
                Vocabulary SRS
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/progress">
                <TrendingUp className="h-4 w-4" />
                Progress
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/mocks">
                <ClipboardList className="h-4 w-4" />
                Mock Exams
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setShowLeaderboard(true)}>
              <Trophy className="h-4 w-4" />
              Leaderboard
            </Button>
            <Button asChild>
              <Link to="/chat">
                <MessageSquare className="h-4 w-4" />
                Chat
                {readyCount > 0 ? ` (${readyCount} ready)` : ""}
              </Link>
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[340px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Upload PDFs</CardTitle>
              <CardDescription>
                Add documents to your knowledge base, organized by subject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadPanel subjects={subjects} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your PDFs</CardTitle>
              <CardDescription>
                {documents ? `${documents.length} document(s)` : "Loading..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-muted-foreground)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading your documents...</span>
                </div>
              ) : isError ? (
                <p className="py-8 text-center text-sm text-[var(--color-destructive)]">
                  Could not load your documents.
                </p>
              ) : (
                <DocumentList
                  documents={documents ?? []}
                  onPreview={setPreviewDoc}
                  onSummarize={setSummaryDoc}
                  onQuiz={setQuizDoc}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {previewDoc && (
        <PdfPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {summaryDoc && (
        <SummaryModal
          document={summaryDoc}
          onClose={() => setSummaryDoc(null)}
        />
      )}

      {quizDoc && (
        <QuizModal document={quizDoc} onClose={() => setQuizDoc(null)} />
      )}

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
