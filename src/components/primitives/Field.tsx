import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

export function FieldLabel({
  className,
  children,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[13px] font-medium text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </label>
  );
}

type FieldInputProps = InputHTMLAttributes<HTMLInputElement>;
export function FieldInput({ className, ...rest }: FieldInputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded border border-ink-20 bg-white px-3.5 text-sm text-ink placeholder:text-ink-40",
        "transition-[border,box-shadow] duration-[var(--dur-base)] ease-out",
        "focus:border-ink focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]",
        className,
      )}
      {...rest}
    />
  );
}

export function FieldTextarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded border border-ink-20 bg-white px-3.5 py-3 text-sm text-ink placeholder:text-ink-40",
        "transition-[border,box-shadow] duration-[var(--dur-base)] ease-out",
        "focus:border-ink focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]",
        className,
      )}
      {...rest}
    />
  );
}

export function FieldSelect({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink",
        "transition-[border,box-shadow] duration-[var(--dur-base)] ease-out",
        "focus:border-ink focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-ink-60">{children}</p>;
}
