export const theme = {
  color: {
    bg: "#f7f6f3",
    surface: "#ffffff",
    surfaceAlt: "#fbfaf8",
    text: "#1a1a1a",
    muted: "#6b7280",
    subtle: "#9ca3af",
    border: "#e7e5e0",
    borderStrong: "#d6d3cd",
    primary: "#6366f1",
    primaryHover: "#4f46e5",
    accent: "#ec4899",
    success: "#10b981",
    danger: "#ef4444",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    pill: "999px",
  },
  shadow: {
    card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.08)",
    soft: "0 1px 2px rgba(0,0,0,0.04)",
    button: "0 1px 2px rgba(99, 102, 241, 0.25)",
  },
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
} as const;
