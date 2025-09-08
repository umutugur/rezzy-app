export const lightTheme = {
  colors: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textSecondary: "#666666",
    primary: "#7B2C2C",
    primaryHover: "#6B2525",
    accent: "#FF6B6B",
    success: "#16A085",
    warning: "#D4AF37",
    error: "#E53935",
    border: "#E6E6E6",
    muted: "#FAFAFA",
  },
  radius: { sm: 8, md: 12, lg: 20, xl: 28 },
  spacing: (n: number) => n * 4,
  typography: { h1: 28, h2: 22, h3: 18, body: 16, small: 13 }
};
export type Theme = typeof lightTheme;
