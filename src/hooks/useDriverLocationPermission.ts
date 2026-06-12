// src/hooks/useDriverLocationPermission.ts
// Sürücü moduna her girişte ve her "Çevrimiçi Ol"da arka plan konum iznini kontrol eder.
// Verilmemişse modal gösterilir — kabul edilene kadar her seferinde.

import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';

export function useDriverLocationPermission() {
  const [modalVisible, setModalVisible] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  /** İzin durumunu kontrol et; tam değilse modal aç. true = arka plan izni tam. */
  const check = useCallback(async (): Promise<boolean> => {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const fgReq = await Location.requestForegroundPermissionsAsync();
      if (fgReq.status !== 'granted') {
        setCanAskAgain(fgReq.canAskAgain);
        setModalVisible(true);
        return false;
      }
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') return true;
    setCanAskAgain(bg.canAskAgain);
    setModalVisible(true);
    return false;
  }, []);

  /** Modal "İzin Ver" butonu. */
  const request = useCallback(async (): Promise<boolean> => {
    if (!canAskAgain) {
      setModalVisible(false);
      Linking.openSettings();
      return false;
    }
    const res = await Location.requestBackgroundPermissionsAsync();
    if (res.status === 'granted') {
      setModalVisible(false);
      return true;
    }
    setCanAskAgain(res.canAskAgain);
    return false;
  }, [canAskAgain]);

  const dismiss = useCallback(() => setModalVisible(false), []);

  return { modalVisible, canAskAgain, check, request, dismiss };
}
