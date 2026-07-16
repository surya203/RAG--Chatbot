import type { ReactNode } from "react";

interface StudentPageShellProps {
  title: string;
  titleHighlight?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
}

const widthClass: Record<NonNullable<StudentPageShellProps["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-full",
};

export default function StudentPageShell({
  title,
  titleHighlight,
  description,
  actions,
  children,
  maxWidth = "5xl",
}: StudentPageShellProps) {
  return (
    <div className={`mx-auto w-full space-y-6 ${widthClass[maxWidth]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-uk-navy">
            {title}
            {titleHighlight && (
              <>
                , <span className="text-uk-red">{titleHighlight}</span>
              </>
            )}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
