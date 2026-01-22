// src/delivery/deliveryTheme.ts
export const DeliveryColors = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#6B7280",
  line: "#E5E7EB",
  card: "#FFFFFF",

  // Rezvix / premium red
  primary: "#7B2C2C",
  primarySoft: "#FFF5F5",

  danger: "#DC2626",
  success: "#16A34A",

  chip: "#F7F4F1",
  chipText: "#3A302C",

  shadow: "#000000",
};

export const DeliveryRadii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const DeliverySpacing = {
  screenX: 16,
  cardPad: 14,
};

export const DeliveryShadow = {
  card: {
    shadowColor: DeliveryColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: DeliveryColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
};