import { toast as sonnerToast } from "sonner";
import type { ExternalToast } from "sonner";

type Variant = "default" | "success" | "error" | "warning" | "info";

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: Variant;
} & ExternalToast;

/** Thin wrapper over sonner so call sites read like our previous toast API. */
export function useToast() {
  return {
    toast: (input: ToastInput | string) => {
      if (typeof input === "string") return sonnerToast(input);
      const { title, description, variant = "default", ...rest } = input;
      const message = title ?? description ?? "";
      const opts = { description: title && description ? description : undefined, ...rest };
      switch (variant) {
        case "success":
          return sonnerToast.success(message, opts);
        case "error":
          return sonnerToast.error(message, opts);
        case "warning":
          return sonnerToast.warning(message, opts);
        case "info":
          return sonnerToast.info(message, opts);
        default:
          return sonnerToast(message, opts);
      }
    },
  };
}

export { sonnerToast as toast };
