export const APP_THEME_COLORS = {
  background: "#ECF1FF",
  surface: "#FFFFFF",
  surfaceLow: "#E7EDFB",
  surfaceHigh: "#D7E1F7",
  onSurface: "#111827",
  onSurfaceMuted: "#475569",
  primary: "#1D4ED8",
  primarySoft: "#DBEAFE",
  secondary: "#0F766E",
  secondarySoft: "#CCFBF1",
  success: "#15803D",
  successSoft: "#DCFCE7",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  outline: "#94A3B8",
  dark: "#111827",
} as const;

export type AppThemeColors = typeof APP_THEME_COLORS;