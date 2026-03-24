import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
}

const variants = {
  primary:   "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400",
  danger:    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost:     "text-gray-600 hover:bg-gray-100 disabled:text-gray-300",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        "inline-flex items-center gap-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 cursor-pointer",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
