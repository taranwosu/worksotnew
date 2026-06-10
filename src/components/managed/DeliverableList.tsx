import { FileText, Download } from "lucide-react";
import { fileDownloadUrl, type ManagedAttachment } from "@/lib/api";
import { cn } from "@/lib/utils";

function prettySize(bytes?: number) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  files,
  theme = "cream",
}: {
  files: ManagedAttachment[];
  theme?: "ink" | "cream";
}) {
  const dark = theme === "ink";
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={fileDownloadUrl(f.id)}
            target="_blank"
            rel="noreferrer"
            data-testid={`attachment-${f.id}`}
            className={cn(
              "flex items-center gap-2 rounded border px-3 py-2 text-[12.5px] transition-colors",
              dark
                ? "border-cream/15 text-cream/90 hover:border-cream/40"
                : "border-ink-12 bg-white text-ink hover:border-ink",
            )}
          >
            <FileText className={cn("h-4 w-4 shrink-0", dark ? "text-cream/50" : "text-ink-40")} />
            <span className="min-w-0 flex-1 truncate font-medium">{f.filename}</span>
            <span className={cn("font-mono text-[10.5px]", dark ? "text-cream/40" : "text-ink-40")}>
              {prettySize(f.size)}
            </span>
            <Download className={cn("h-3.5 w-3.5 shrink-0", dark ? "text-cream/50" : "text-ink-40")} />
          </a>
        </li>
      ))}
    </ul>
  );
}
