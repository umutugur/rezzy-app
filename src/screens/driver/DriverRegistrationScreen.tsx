// src/screens/driver/DriverRegistrationScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Car, FileText, Palette, Hash } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../contexts/ThemeContext';
import { registerDriver, type DriverRegistrationPayload } from '../../api/taxi';

type VehicleType = 'sedan' | 'van' | 'luxury' | 'pet';

const VEHICLE_TYPES: { value: VehicleType; label: string; emoji: string }[] = [
  { value: 'sedan', label: 'Sedan', emoji: '🚗' },
  { value: 'van', label: 'Van / XL', emoji: '🚐' },
  { value: 'luxury', label: 'Lüks', emoji: '🚙' },
  { value: 'pet', label: 'Evcil Dost', emoji: '🐾' },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'words',
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  icon: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.lg,
        paddingHorizontal: 14,
        borderWidth: 1, borderColor: theme.colors.borderDefault,
      }}>
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize={autoCapitalize}
          style={{ flex: 1, ...theme.typography.bodyMd, color: theme.colors.textPrimary, paddingVertical: 12 }}
        />
      </View>
    </View>
  );
}

export default function DriverRegistrationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [license, setLicense] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValid = plate.trim() && brand.trim() && model.trim() && color.trim();

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const payload: DriverRegistrationPayload = {
        vehiclePlate: plate.trim().toUpperCase(),
        vehicleBrand: brand.trim(),
        vehicleModel: model.trim(),
        vehicleColor: color.trim(),
        type: vehicleType,
        licenseNumber: license.trim() || undefined,
      };
      await registerDriver(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      setTimeout(() => navigation.goBack(), 2000);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Başvuru gönderilemedi. Lütfen tekrar deneyin.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [plate, brand, model, color, license, vehicleType, isValid, submitting, navigation]);

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
        <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
          Başvuru Alındı!
        </Text>
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
          Admin onayından sonra sürücü paneline erişebilirsiniz. Yönlendiriliyorsunuz...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 28, gap: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.taxi.main + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={36} color={theme.taxi.main} strokeWidth={1.5} />
          </View>
          <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary }}>
            Sürücü Başvurusu
          </Text>
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
            Araç bilgilerinizi girin. Başvurunuz admin onayından sonra aktif olacak.
          </Text>
        </View>

        {/* Vehicle type selector */}
        <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 8 }}>
          Araç Tipi
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {VEHICLE_TYPES.map((vt) => (
            <TouchableOpacity
              key={vt.value}
              onPress={() => setVehicleType(vt.value)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: theme.radius.lg,
                borderWidth: 1.5,
                borderColor: vehicleType === vt.value ? theme.taxi.main : theme.colors.borderDefault,
                backgroundColor: vehicleType === vt.value ? theme.taxi.main + '18' : theme.colors.surface,
              }}
            >
              <Text style={{ fontSize: 16 }}>{vt.emoji}</Text>
              <Text style={{ ...theme.typography.labelMd, color: vehicleType === vt.value ? theme.taxi.main : theme.colors.textSecondary }}>
                {vt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fields */}
        <Field
          label="Plaka *"
          value={plate}
          onChangeText={setPlate}
          placeholder="34 ABC 123"
          autoCapitalize="characters"
          icon={<Hash size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
        />
        <Field
          label="Marka *"
          value={brand}
          onChangeText={setBrand}
          placeholder="Toyota, Renault, Ford..."
          icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
        />
        <Field
          label="Model *"
          value={model}
          onChangeText={setModel}
          placeholder="Corolla, Clio, Focus..."
          icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
        />
        <Field
          label="Renk *"
          value={color}
          onChangeText={setColor}
          placeholder="Beyaz, Siyah, Gri..."
          icon={<Palette size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
        />
        <Field
          label="Ehliyet No (isteğe bağlı)"
          value={license}
          onChangeText={setLicense}
          placeholder="Ehliyet numaranız"
          autoCapitalize="characters"
          icon={<FileText size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
        />

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            backgroundColor: theme.taxi.main,
            borderRadius: theme.radius.xl,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
            opacity: (!isValid || submitting) ? 0.5 : 1,
          }}
        >
          <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
            {submitting ? 'Gönderiliyor…' : 'Başvuruyu Gönder'}
          </Text>
        </TouchableOpacity>

        {submitError && (
          <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            {submitError}
          </Text>
        )}

        <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, textAlign: 'center', marginTop: 16 }}>
          Başvurunuz 1-2 iş günü içinde değerlendirilir.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
