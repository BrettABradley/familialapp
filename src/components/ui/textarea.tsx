import * as React from "react";

import { cn } from "@/lib/utils";
import { typingHaptic } from "@/lib/haptics";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onKeyDown, ...props }, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      typingHaptic();
    }
    onKeyDown?.(e);
  };
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
