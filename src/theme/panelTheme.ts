// Rezzy panel için hafif tasarım katmanı (chipler, kart, renkler)
export const panel = {
  radius: { xs: 8, sm: 10, md: 14, xl: 22 },
  gap: { xs: 6, sm: 10, md: 14, lg: 18 },
  colors: {
    bg: "#F7F7F9",          // sayfa arkası (çok açık gri)
    surface: "#FFFFFF",
    text: "#1F2937",
    sub: "#6B7280",
    border: "#E5E7EB",
    brand: "#7B2C2C",        // Rezzy ana
    brandSoft: "#F5E8E8",
    muted: "#F2F3F5",
    danger: "#DC2626",
    success: "#16A34A",
    warning: "#D97706",
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as const,
  },
};

// kısa yardımcı stiller
export const cardStyle = {
  backgroundColor: panel.colors.surface,
  borderRadius: panel.radius.md,
  borderWidth: 1,
  borderColor: panel.colors.border,
  padding: 14,
  ...panel.shadow.card,
} as const;

export const chip = (active = false) => ({
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  backgroundColor: active ? panel.colors.brand : panel.colors.muted,
} as const);

export const chipText = (active = false) => ({
  color: active ? "#fff" : panel.colors.text,
  fontWeight: active ? "700" : "500",
} as const);

export const pillMuted = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: panel.colors.muted,
} as const;

export const btnPrimary = {
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderRadius: panel.radius.md,
  backgroundColor: panel.colors.brand,
  alignItems: "center",
} as const;

export const btnSecondary = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: panel.radius.md,
  backgroundColor: panel.colors.muted,
  alignItems: "center",
} as const;

export const inputStyle = {
  borderWidth: 1,
  borderColor: panel.colors.border,
  backgroundColor: "#fff",
  borderRadius: panel.radius.sm,
  paddingHorizontal: 10,
  paddingVertical: 10,
  color: panel.colors.text,
} as const;