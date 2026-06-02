// src/navigation/TaxiNavigator.tsx
// Stack navigator for the passenger-side taxi flow.

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import TaxiHomeScreen from '../screens/taxi/TaxiHomeScreen';
import TaxiDestinationScreen from '../screens/taxi/TaxiDestinationScreen';
import TaxiMatchedScreen from '../screens/taxi/TaxiMatchedScreen';
import TaxiReceiptScreen from '../screens/taxi/TaxiReceiptScreen';
import TaxiHistoryScreen from '../screens/taxi/TaxiHistoryScreen';
import TaxiRideDetailScreen from '../screens/taxi/TaxiRideDetailScreen';
import { useTheme } from '../theme';

export type TaxiStackParams = {
  TaxiHome: undefined;
  TaxiDestination: undefined;
  TaxiMatched: { rideId: string };
  TaxiReceipt: {
    rideId: string;
    fare: number;
    distanceKm: number;
    durationMin: number;
    pickupAddress: string;
    dropoffAddress: string;
    paymentMethod: string;
    driverId: string;
  };
  TaxiHistory: undefined;
  TaxiRideDetail: { rideId: string };
};

const Stack = createStackNavigator<TaxiStackParams>();

export default function TaxiNavigator() {
  const { colors, typography } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="TaxiHome"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: typography.headingMd.fontSize,
          color: colors.textPrimary,
        },
      }}
    >
      <Stack.Screen
        name="TaxiHome"
        component={TaxiHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TaxiDestination"
        component={TaxiDestinationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TaxiMatched"
        component={TaxiMatchedScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="TaxiReceipt"
        component={TaxiReceiptScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="TaxiHistory"
        component={TaxiHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TaxiRideDetail"
        component={TaxiRideDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
