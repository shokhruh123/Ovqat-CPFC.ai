import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-ripple inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--ink)] text-[var(--paper)] hover:opacity-90",
        primary:
          "bg-[var(--accent)] text-white shadow-[0_10px_24px_-10px_rgba(217,119,6,0.6)] hover:brightness-105 dark:text-[#1c1005]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--line-2)]",
        outline: "border border-[var(--line-2)] bg-transparent hover:bg-[var(--surface-2)]",
        ghost: "hover:bg-[var(--surface-2)]",
        destructive: "bg-[var(--bad)] text-white hover:brightness-110",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-14 px-8 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  busy?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, busy, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || busy}
      className={cn(buttonVariants({ variant, size }), busy && "btn-busy", className)}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
