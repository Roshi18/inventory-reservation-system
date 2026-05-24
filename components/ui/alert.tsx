import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border p-3 text-sm",
        variant === "destructive" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "success" && "border-primary/30 bg-primary/10 text-primary",
        variant === "default" && "bg-card text-card-foreground",
        className
      )}
      {...props}
    />
  );
}
