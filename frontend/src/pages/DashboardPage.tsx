import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen, Loader2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

import DocumentList from "@/components/DocumentList";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import QuizModal from "@/components/QuizModal";
import StudentPageShell from "@/components/StudentPageShell";
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
  const { user } = useAuth();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [summaryDoc, setSummaryDoc] = useState<Document | null>(null);
  const [quizDoc, setQuizDoc] = useState<Document | null>(null);

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
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

  const processingCount = useMemo(
    () =>
      (documents ?? []).filter(
        (d) => d.status === "pending" || d.status === "processing"
      ).length,
    [documents]
  );

  return (
    <StudentPageShell
      title="Welcome back"
      titleHighlight={user?.full_name ?? undefined}
      description="Upload study PDFs, chat with your materials, and practice all four exam skills from the sidebar."
      maxWidth="6xl"
      actions={
        <Button
          asChild
          className="bg-uk-red shadow-md hover:bg-uk-red-dark"
        >
          <Link to="/chat">
            <MessageSquare className="h-4 w-4" />
            Open PDF Chat
            {readyCount > 0 ? ` (${readyCount} ready)` : ""}
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-0 bg-uk-navy text-white shadow-lg">
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100/90">
                  Ready for chat
                </p>
                <p className="mt-2 text-4xl font-bold">{readyCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-uk-red" />
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Total PDFs
                </p>
                <div className="mt-1 h-0.5 w-8 bg-uk-red" />
                <p className="mt-2 text-4xl font-bold text-uk-navy">
                  {documents?.length ?? 0}
                </p>
              </div>
              <FileText className="h-5 w-5 text-uk-red" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Processing
                </p>
                <p className="mt-2 text-4xl font-bold text-uk-navy">
                  {processingCount}
                </p>
              </div>
              {processingCount > 0 ? (
                <Loader2 className="h-5 w-5 animate-spin text-uk-navy" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-uk-navy/20" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-uk-navy">
              <FileText className="h-5 w-5 text-uk-red" />
              Upload PDFs
            </CardTitle>
            <CardDescription>
              Add documents to your knowledge base, organized by subject.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadPanel subjects={subjects} />
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-uk-navy">
              Your library
              <span className="mt-1 block h-0.5 w-10 bg-uk-red" />
            </CardTitle>
            <CardDescription>
              {documents
                ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
                : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[var(--color-muted-foreground)]">
                <Loader2 className="h-5 w-5 animate-spin text-uk-navy" />
                <span className="text-sm">Loading your documents...</span>
              </div>
            ) : isError ? (
              <p className="py-12 text-center text-sm text-uk-red">
                Could not load your documents.
              </p>
            ) : (documents ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="mb-3 h-12 w-12 text-uk-navy/30" />
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No PDFs yet. Upload some to get started.
                </p>
              </div>
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
    </StudentPageShell>
  );
}
