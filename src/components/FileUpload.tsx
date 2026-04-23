import { useMutation } from "convex/react";
import { UploadCloud, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type UploadedFileMeta = {
  storageId: Id<"_storage">;
  fileName: string;
  contentType: string;
  size: number;
};

type FileUploadProps = {
  onUploaded: (meta: UploadedFileMeta) => void | Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function FileUpload({
  onUploaded,
  accept,
  maxSizeMB = 20,
  label = "Upload a file",
  hint,
  compact = false,
  disabled = false,
}: FileUploadProps) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const pickFile = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    setError(null);
    if (file.size > maxBytes) {
      setError(`File is too large (max ${maxSizeMB} MB)`);
      return;
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      await onUploaded({
        storageId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={pickFile}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading…" : label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={pickFile}
        disabled={disabled || uploading}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-all ${
          dragOver
            ? "border-slate-900 bg-slate-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        } ${disabled || uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        ) : (
          <UploadCloud className="h-6 w-6 text-slate-400" />
        )}
        <div className="text-center">
          <p className="font-semibold text-slate-700">
            {uploading ? "Uploading…" : label}
          </p>
          {hint && !uploading && (
            <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
          )}
          {!uploading && (
            <p className="mt-0.5 text-xs text-slate-500">
              Click to browse or drop a file (max {maxSizeMB} MB)
            </p>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
