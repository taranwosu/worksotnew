// Temporary stub; native-upload implementation pending. The prop and
// metadata shapes here only need to satisfy callers' type expectations
// — the runtime body still no-ops.

import type { Id } from "../../convex/_generated/dataModel";

export type UploadedFileMeta = {
  storageId: Id<"_storage">;
  fileName: string;
  size?: number;
  contentType?: string;
};

export type FileUploadProps = {
  accept?: string;
  label?: string;
  hint?: string;
  maxSizeMB?: number;
  compact?: boolean;
  onUploaded?: (meta: UploadedFileMeta) => void;
};

export function FileUpload(_props: FileUploadProps) {
  return null;
}

export default FileUpload;
