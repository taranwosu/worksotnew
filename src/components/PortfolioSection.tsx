import { useMutation, useQuery } from "convex/react";
import { FileText, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FileUpload, type UploadedFileMeta } from "./FileUpload";

type Props = {
  expertProfileId: Id<"expertProfiles">;
};

export function PortfolioSection({ expertProfileId }: Props) {
  const items = useQuery(api.portfolio.listMyPortfolioItems, {
    expertProfileId,
  });
  const addItem = useMutation(api.portfolio.addPortfolioItem);
  const deleteItem = useMutation(api.portfolio.deletePortfolioItem);

  const [pendingUpload, setPendingUpload] = useState<UploadedFileMeta | null>(
    null
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelPending = () => {
    setPendingUpload(null);
    setTitle("");
    setDescription("");
    setError(null);
  };

  const onSave = async () => {
    if (!pendingUpload) return;
    setSaving(true);
    setError(null);
    try {
      await addItem({
        expertProfileId,
        storageId: pendingUpload.storageId,
        fileName: pendingUpload.fileName,
        contentType: pendingUpload.contentType,
        title: title.trim() || pendingUpload.fileName,
        description: description.trim() || undefined,
        size: pendingUpload.size,
      });
      cancelPending();
    } catch (e: any) {
      setError(e?.message ?? "Could not save portfolio item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-12 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Portfolio</h3>
          <p className="mt-0.5 text-xs text-ink-60">
            Work samples, case studies, and deliverables for clients to review.
          </p>
        </div>
        <span className="rounded-full bg-cream-2 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-60">
          {items?.length ?? 0} {items?.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {pendingUpload ? (
          <div className="rounded-lg border border-ink-12 bg-paper p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FileText className="h-4 w-4 text-ink-40" />
              <span className="truncate">{pendingUpload.fileName}</span>
            </div>
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. 'SaaS financial model')"
                maxLength={120}
                className="w-full rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-rust">{error}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelPending}
                disabled={saving}
                className="rounded-lg border border-ink-20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save item
              </button>
            </div>
          </div>
        ) : (
          <FileUpload
            accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            maxSizeMB={20}
            label="Add portfolio item"
            hint="Images, PDFs, slides, or spreadsheets — up to 20 MB each"
            onUploaded={(meta) => {
              setPendingUpload(meta);
              setTitle("");
              setDescription("");
            }}
          />
        )}

        {!items ? (
          <div className="grid gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-cream-2" />
            ))}
          </div>
        ) : items.length === 0 ? null : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item._id}
                className="flex items-center gap-3 rounded-lg border border-ink-12 bg-white p-3"
              >
                <PortfolioThumbnail
                  url={item.url ?? null}
                  contentType={item.contentType ?? null}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="line-clamp-1 text-xs text-ink-60">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-ink-40">
                    {item.fileName}
                    {item.size ? ` · ${formatSize(item.size)}` : ""}
                  </p>
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-ink-12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                  >
                    Open
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => deleteItem({ id: item._id })}
                  className="rounded-lg p-1.5 text-ink-40 hover:bg-cream-2 hover:text-rust"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PortfolioThumbnail({
  url,
  contentType,
}: {
  url: string | null;
  contentType: string | null;
}) {
  const isImage = contentType?.startsWith("image/") && url;
  if (isImage) {
    return (
      <img
        src={url!}
        alt=""
        className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cream-2 text-ink-60">
      {contentType?.startsWith("image/") ? (
        <ImageIcon className="h-4 w-4" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
