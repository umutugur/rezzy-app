import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {
  Utensils,
  ShoppingCart,
  Car,
  User,
  MapPin,
  Navigation,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';

export type MarkerType =
  | 'restaurant'
  | 'market'
  | 'taxi'
  | 'driver'
  | 'user'
  | 'pickup'
  | 'dropoff';

export interface MapMarkerProps {
  type?: MarkerType;
  label?: string;
  isActive?: boolean;
  count?: number;
  style?: ViewStyle;
}

interface MarkerConfig {
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
}

// ⚠️ NOT a hook — "use" prefix removed to avoid React hook counter confusion
function getMarkerConfig(type: MarkerType, theme: ReturnType<typeof useTheme>): MarkerConfig {
  switch (type) {
    case 'restaurant':
      return { Icon: Utensils, bg: theme.brand[600], iconColor: theme.colors.textInverse };
    case 'market':
      return { Icon: ShoppingCart, bg: theme.market.main, iconColor: theme.colors.textInverse };
    case 'taxi':
      return { Icon: Car, bg: theme.taxi.main, iconColor: theme.colors.textInverse };
    case 'driver':
      return { Icon: Navigation, bg: theme.driver.main, iconColor: theme.colors.textInverse };
    case 'user':
      return { Icon: User, bg: theme.brand[600], iconColor: theme.colors.textInverse };
    case 'pickup':
      return { Icon: MapPin, bg: theme.colors.success, iconColor: theme.colors.textInverse };
    case 'dropoff':
      return { Icon: MapPin, bg: theme.colors.error, iconColor: theme.colors.textInverse };
  }
}

export function MapMarker({
  type = 'restaurant',
  label,
  isActive = false,
  count,
  style,
}: MapMarkerProps) {
  const theme = useTheme();
  const config = getMarkerConfig(type, theme); // pure fn, not a hook
  const scale = useSharedValue(isActive ? 1.2 : 1);
  const pulseOpacity = useSharedValue(1);

  // Active scale
  useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 1, theme.spring.default);
  }, [isActive, scale, theme.spring.default]);

  // Driver pulse animation
  useEffect(() => {
    if (type === 'driver') {
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 700 }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [type, pulseOpacity]);

  const markerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const baseSize = 44;
  const iconSize = 20;

  const activeShadow = isActive ? theme.getElevation(4) : theme.getElevation(2);

  return (
    <Animated.View style={[styles.wrapper, markerAnimStyle, style]}>
      {/* Pulse ring for driver */}
      {type === 'driver' && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: baseSize + 16,
              height: baseSize + 16,
              borderRadius: (baseSize + 16) / 2,
              borderColor: config.bg,
              borderWidth: 2,
              position: 'absolute',
              top: -8,
              left: -8,
            },
            pulseAnimStyle,
          ]}
        />
      )}

      {/* Marker body */}
      <View
        style={[
          {
            width: baseSize,
            height: baseSize,
            borderRadius: baseSize / 2,
            backgroundColor: config.bg,
            alignItems: 'center',
            justifyContent: 'center',
            ...activeShadow,
          },
        ]}
      >
        <config.Icon size={iconSize} color={config.iconColor} strokeWidth={2} />

        {/* Count badge */}
        {count !== undefined && count > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: theme.colors.error,
              width: 18,
              height: 18,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.surface,
            }}
          >
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.textInverse,
                fontSize: 9,
                lineHeight: 12,
              }}
            >
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        )}
      </View>

      {/* Label */}
      {label ? (
        <View
          style={{
            marginTop: 4,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.space[2],
            paddingVertical: 2,
            borderRadius: theme.radius.xs,
            ...theme.getElevation(1),
            alignSelf: 'center',
          }}
        >
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.textPrimary,
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
});
