// src/screens/partner/PartnerApplicationScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  Car,
  Palette,
  Hash,
  Camera,
  ImageUp,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Store,
  UtensilsCrossed,
  Tag,
  MapPin,
  Phone,
  Building2,
  Navigation,
  ChevronDown,
  Search,
  X,
} from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n';
import { useRegion } from '../../store/useRegion';
import {
  getPartnerRequirements,
  getMyPartnerApplication,
  submitPartnerApplication,
  resubmitPartnerApplication,
  uploadToCloud,
  getVehicleMakes,
  getVehicleModels,
  type DriverDocRequirement,
  type DriverApplication,
  type DriverI18n,
  type AppType,
  type VehicleMakeItem,
  type VehicleModelItem,
} from '../../api/driverApplication.api';

type VehicleType = 'sedan' | 'van' | 'luxury' | 'pet';

const VEHICLE_TYPES: { value: VehicleType; emoji: string; labelKey: string }[] = [
  { value: 'sedan', emoji: '🚗', labelKey: 'partner.vehicleType.sedan' },
  { value: 'van', emoji: '🚐', labelKey: 'partner.vehicleType.van' },
  { value: 'luxury', emoji: '🚙', labelKey: 'partner.vehicleType.luxury' },
  { value: 'pet', emoji: '🐾', labelKey: 'partner.vehicleType.pet' },
];

/** region (2 harfli ISO) -> requirements API country kodu. CY → KKTC, belirsizse KKTC. */
function regionToCountryCode(region?: string | null): string {
  const r = String(region || '').toUpperCase();
  if (!r) return 'KKTC';
  if (r === 'CY') return 'KKTC';
  return r;
}

/** Lokalize i18n alanı seç: aktif dil -> tr fallback -> ilk dolu değer. */
function pickI18n(obj: DriverI18n | undefined, lang: string): string {
  if (!obj) return '';
  const byLang = (obj as any)[lang] as string | undefined;
  return byLang || obj.tr || obj.en || obj.ru || obj.el || '';
}

// Belge başına yerel düzenleme durumu
type DocState = { fileUrl: string; number: string; expiry: string; uploading: boolean };

type Coords = { lat: number; lng: number };

export default function PartnerApplicationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);

  const appType: AppType = (route.params?.appType as AppType) || 'driver';
  const isDriver = appType === 'driver';
  const isBusiness = appType === 'market' || appType === 'restaurant';

  // Vertical accent: driver → driver token, market → market token, restaurant → primary brand.
  const ACCENT =
    appType === 'driver' ? theme.driver.main : appType === 'market' ? theme.market.main : theme.colors.primary;
  const ACCENT_SOFT =
    appType === 'driver' ? theme.driver.light : appType === 'market' ? theme.market.light : theme.colors.errorSoft;

  const HeaderIcon = isDriver ? Car : appType === 'market' ? Store : UtensilsCrossed;
  const countryCode = useMemo(() => regionToCountryCode(region), [region]);

  // ─── data ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [requirements, setRequirements] = useState<DriverDocRequirement[]>([]);

  // ─── driver form state ───────────────────────────────────────────────────────
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');

  // ─── vehicle catalog (make → model dropdowns) ────────────────────────────────
  const [makes, setMakes] = useState<VehicleMakeItem[]>([]);
  const [models, setModels] = useState<VehicleModelItem[]>([]);
  const [brandOther, setBrandOther] = useState(false);
  const [modelOther, setModelOther] = useState(false);
  const [makeSheet, setMakeSheet] = useState(false);
  const [modelSheet, setModelSheet] = useState(false);

  // ─── business form state ─────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [selfieUrl, setSelfieUrl] = useState('');
  const [selfieUploading, setSelfieUploading] = useState(false);

  // requirementKey -> DocState
  const [docs, setDocs] = useState<Record<string, DocState>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [app, reqs] = await Promise.all([
        getMyPartnerApplication(),
        getPartnerRequirements(appType, countryCode),
      ]);
      // Only hydrate from the application if it matches THIS appType.
      const matching = app && app.appType === appType ? app : null;
      setApplication(matching);
      setRequirements((reqs || []).slice().sort((a, b) => a.order - b.order));

      if (matching) {
        const p = matching.payload || {};
        if (isDriver) {
          setPlate((matching.vehicle?.plate || p.plate) ?? '');
          setBrand((matching.vehicle?.brand || p.brand) ?? '');
          setModel((matching.vehicle?.model || p.model) ?? '');
          setColor((matching.vehicle?.color || p.color) ?? '');
          setVehicleType(((matching.vehicle?.type || p.type) as VehicleType) || 'sedan');
        } else {
          setBusinessName(p.businessName ?? '');
          setCategory(p.category ?? '');
          setAddress(p.address ?? '');
          setPhone(p.phone ?? '');
          const c = p.location?.coordinates;
          if (Array.isArray(c) && c.length === 2) setCoords({ lng: Number(c[0]), lat: Number(c[1]) });
        }
        setSelfieUrl(matching.selfieUrl || '');
        const seeded: Record<string, DocState> = {};
        (matching.documents || []).forEach((d) => {
          seeded[d.requirementKey] = {
            fileUrl: d.fileUrl || '',
            number: d.number || '',
            expiry: d.expiry || '',
            uploading: false,
          };
        });
        setDocs(seeded);
      }
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || e?.message || t('partner.error.load'));
    } finally {
      setLoading(false);
    }
    // `t` deliberately excluded: useI18n's t is a fresh ref each render and would
    // recreate load → re-fire the effect in a loop (infinite re-fetch / stuck loading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, appType, isDriver]);

  useEffect(() => {
    load();
  }, [load]);

  // Load vehicle makes for the active country (driver only).
  useEffect(() => {
    if (!isDriver || !countryCode) return;
    getVehicleMakes(countryCode).then(setMakes).catch(() => setMakes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriver, countryCode]); // no `t`

  // Load models whenever a catalog brand is chosen (skip when free-text "other").
  useEffect(() => {
    if (!isDriver || !countryCode || !brand || brandOther) {
      setModels([]);
      return;
    }
    getVehicleModels(countryCode, brand).then(setModels).catch(() => setModels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriver, countryCode, brand, brandOther]); // no `t`

  const status = application?.status ?? null;
  const isReadOnly = status === 'pending' || status === 'approved';
  const isRejected = status === 'rejected';

  // hangi belgeler düzenlenebilir? rejected modunda yalnızca status==="rejected" olanlar.
  const isDocEditable = useCallback(
    (key: string) => {
      if (!application) return true; // yeni başvuru
      if (status === 'draft') return true;
      if (isRejected) {
        const d = application.documents.find((x) => x.requirementKey === key);
        return d?.status === 'rejected';
      }
      return false;
    },
    [application, status, isRejected],
  );

  // ─── location capture (business map pin) ─────────────────────────────────────
  const onUseMyLocation = useCallback(async () => {
    try {
      setLocLoading(true);
      setLocError(null);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocError(t('partner.business.locationPermission'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = Number(pos.coords.latitude);
      const lng = Number(pos.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Invalid location');
      setCoords({ lat, lng });
      Haptics.selectionAsync();
    } catch (e: any) {
      setLocError(e?.message || t('partner.business.locationFail'));
    } finally {
      setLocLoading(false);
    }
  }, [t]);

  // ─── image pick + upload ────────────────────────────────────────────────────
  const pickImage = useCallback(async (
    source: 'camera' | 'library' = 'library',
  ): Promise<{ uri: string; name: string; type: string } | null> => {
    let r: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return null;
      r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
    }
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];

    // Yükleme öncesi yeniden boyutlandır + sıkıştır:
    //  • payload'ı ~3-4MB'tan birkaç yüz KB'a düşürür → mobil uplink'te abort olmaz
    //  • iCloud/FileProvider URI'sini temiz, yerel bir JPEG'e dönüştürür
    const manipulated = await manipulateAsync(
      a.uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: SaveFormat.JPEG },
    );
    return {
      uri: manipulated.uri,
      name: `upload-${Date.now()}.jpg`,
      type: 'image/jpeg',
    };
  }, []);

  const chooseSelfieSource = useCallback(
    (): Promise<'camera' | 'library' | null> =>
      new Promise((resolve) => {
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: [t('partner.selfie.camera'), t('partner.selfie.library'), t('partner.selfie.cancel')],
              cancelButtonIndex: 2,
            },
            (i) => resolve(i === 0 ? 'camera' : i === 1 ? 'library' : null),
          );
        } else {
          Alert.alert(t('partner.selfie.pick'), undefined, [
            { text: t('partner.selfie.camera'), onPress: () => resolve('camera') },
            { text: t('partner.selfie.library'), onPress: () => resolve('library') },
            { text: t('partner.selfie.cancel'), style: 'cancel', onPress: () => resolve(null) },
          ]);
        }
      }),
    [t],
  );

  const onPickSelfie = useCallback(async () => {
    try {
      const src = await chooseSelfieSource();
      if (!src) return;
      const file = await pickImage(src);
      if (!file) return;
      setSelfieUploading(true);
      const url = await uploadToCloud(file);
      setSelfieUrl(url);
      Haptics.selectionAsync();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('partner.error.upload'));
    } finally {
      setSelfieUploading(false);
    }
  }, [pickImage, chooseSelfieSource, t]);

  const onPickDoc = useCallback(
    async (key: string) => {
      try {
        const file = await pickImage('library');
        if (!file) return;
        setDocs((prev) => ({ ...prev, [key]: { ...(prev[key] || { number: '', expiry: '', fileUrl: '' }), uploading: true } }));
        const url = await uploadToCloud(file);
        setDocs((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || { number: '', expiry: '' }), fileUrl: url, uploading: false } as DocState,
        }));
        Haptics.selectionAsync();
      } catch (e: any) {
        setDocs((prev) => ({ ...prev, [key]: { ...(prev[key] as DocState), uploading: false } }));
        setSubmitError(e?.response?.data?.message || e?.message || t('partner.error.upload'));
      }
    },
    [pickImage, t],
  );

  const setDocField = useCallback((key: string, field: 'number' | 'expiry', value: string) => {
    setDocs((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { fileUrl: '', number: '', expiry: '', uploading: false }), [field]: value } as DocState,
    }));
  }, []);

  // ─── validation ─────────────────────────────────────────────────────────────
  const driverValid = !!(plate.trim() && brand.trim() && model.trim() && color.trim());
  const businessValid = !!(businessName.trim() && category.trim() && address.trim() && coords);
  const payloadValid = isDriver ? driverValid : businessValid;

  const requiredDocsFilled = requirements
    .filter((r) => r.required && r.file)
    .every((r) => !!docs[r.key]?.fileUrl);
  const selfieOk = isDriver ? !!selfieUrl : true;
  const canSubmit = payloadValid && selfieOk && requiredDocsFilled && !submitting;

  const buildDocsPayload = useCallback(
    (onlyEditable = false) => {
      return requirements
        .filter((r) => (onlyEditable ? isDocEditable(r.key) : true) && !!docs[r.key]?.fileUrl)
        .map((r) => {
          const d = docs[r.key];
          const out: { requirementKey: string; fileUrl: string; number?: string; expiry?: string | null } = {
            requirementKey: r.key,
            fileUrl: d.fileUrl,
          };
          if (r.number && d.number.trim()) out.number = d.number.trim();
          if (r.expiry) out.expiry = d.expiry.trim() ? d.expiry.trim() : null;
          return out;
        });
    },
    [requirements, docs, isDocEditable],
  );

  const buildPayload = useCallback((): Record<string, any> => {
    if (isDriver) {
      return {
        plate: plate.trim().toUpperCase(),
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim(),
        type: vehicleType,
      };
    }
    const out: Record<string, any> = {
      businessName: businessName.trim(),
      category: category.trim(),
      address: address.trim(),
    };
    if (coords) out.location = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    if (phone.trim()) out.phone = phone.trim();
    return out;
  }, [isDriver, plate, brand, model, color, vehicleType, businessName, category, address, coords, phone]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await submitPartnerApplication({
        appType,
        countryCode,
        payload: buildPayload(),
        selfieUrl: isDriver ? selfieUrl : '',
        documents: buildDocsPayload(false),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApplication(updated);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('partner.error.submit'));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, appType, countryCode, buildPayload, selfieUrl, isDriver, buildDocsPayload, t]);

  const onResubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await resubmitPartnerApplication(buildDocsPayload(true));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApplication(updated);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('partner.error.submit'));
    } finally {
      setSubmitting(false);
    }
  }, [buildDocsPayload, t]);

  const rejectedDocsReady = requirements
    .filter((r) => isDocEditable(r.key))
    .every((r) => !!docs[r.key]?.fileUrl);

  const styles = useMemo(() => ({ accent: ACCENT, accentSoft: ACCENT_SOFT }), [ACCENT, ACCENT_SOFT]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginTop: 12 }}>
          {t('partner.loading')}
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <AlertCircle size={40} color={theme.colors.error} strokeWidth={1.5} />
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 16 }}>
          {loadError}
        </Text>
        <TouchableOpacity
          onPress={load}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: theme.radius.xl, paddingHorizontal: 20, paddingVertical: 12 }}
        >
          <RefreshCw size={16} color={theme.colors.textInverse} strokeWidth={2} />
          <Text style={{ ...theme.typography.labelMd, color: theme.colors.textInverse }}>{t('partner.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── APPROVED ──────────────────────────────────────────────────────────────
  if (status === 'approved') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <ShieldCheck size={44} color={theme.colors.success} strokeWidth={1.5} />
        </View>
        <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
          {t('partner.approved.title')}
        </Text>
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
          {t(`partner.approved.body.${appType}`)}
        </Text>
      </View>
    );
  }

  // ── PENDING ───────────────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Clock size={44} color={theme.colors.warning} strokeWidth={1.5} />
        </View>
        <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
          {t('partner.pending.title')}
        </Text>
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
          {t('partner.pending.body')}
        </Text>
        {!!application?.createdAt && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}>
            {t('partner.submittedAt', { date: new Date(application.createdAt).toLocaleDateString() })}
          </Text>
        )}
      </View>
    );
  }

  // ── EDITABLE (no app / draft / rejected) ───────────────────────────────────
  const headerTitle = isRejected ? t('partner.rejected.title') : t(`partner.title.${appType}`);
  const headerSub = isRejected ? t('partner.rejected.body') : t(`partner.subtitle.${appType}`);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 8}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 16, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 24, gap: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: styles.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            {isRejected ? <XCircle size={34} color={theme.colors.error} strokeWidth={1.5} /> : <HeaderIcon size={34} color={ACCENT} strokeWidth={1.5} />}
          </View>
          <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary, textAlign: 'center' }}>{headerTitle}</Text>
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>{headerSub}</Text>
        </View>

        {/* Rejection banner */}
        {isRejected && !!application?.rejectReason && (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radius.lg, padding: 14, marginBottom: 20 }}>
            <AlertCircle size={18} color={theme.colors.error} strokeWidth={2} />
            <Text style={{ flex: 1, ...theme.typography.bodyMd, color: theme.colors.error }}>{application.rejectReason}</Text>
          </View>
        )}

        {/* ── PAYLOAD: DRIVER ── */}
        {isDriver && (
          <>
            <SectionTitle theme={theme} accent={ACCENT}>{t('partner.section.vehicle')}</SectionTitle>

            <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 8 }}>
              {t('partner.field.vehicleType')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {VEHICLE_TYPES.map((vt) => {
                const active = vehicleType === vt.value;
                return (
                  <TouchableOpacity
                    key={vt.value}
                    activeOpacity={0.85}
                    disabled={isReadOnly || isRejected}
                    onPress={() => setVehicleType(vt.value)}
                    style={{
                      flex: 1, alignItems: 'center', gap: 4,
                      paddingVertical: 10, paddingHorizontal: 4,
                      borderRadius: theme.radius.lg, borderWidth: 1.5,
                      borderColor: active ? ACCENT : theme.colors.borderDefault,
                      backgroundColor: active ? styles.accentSoft : theme.colors.surface,
                      opacity: isRejected ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 22, lineHeight: 26 }}>{vt.emoji}</Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        ...theme.typography.labelSm,
                        fontSize: 11,
                        textAlign: 'center',
                        color: active ? ACCENT : theme.colors.textSecondary,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {t(vt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field theme={theme} label={t('partner.field.plate')} value={plate} onChangeText={setPlate} placeholder="34 ABC 123" autoCapitalize="characters" editable={!isRejected} icon={<Hash size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />

            {/* Brand — catalog dropdown + "Other" free-text fallback */}
            <SelectorButton
              theme={theme}
              accent={ACCENT}
              label={t('partner.field.brand')}
              value={brand}
              placeholder={t('partner.vehicle.selectBrand')}
              disabled={isRejected}
              onPress={() => setMakeSheet(true)}
              icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
            />
            {brandOther && (
              <Field theme={theme} label={t('partner.vehicle.brandFree')} value={brand} onChangeText={setBrand} placeholder="Toyota, Renault…" editable={!isRejected} icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
            )}

            {/* Model — depends on a selected brand; catalog dropdown + "Other" free-text */}
            <SelectorButton
              theme={theme}
              accent={ACCENT}
              label={t('partner.field.model')}
              value={model}
              placeholder={t('partner.vehicle.selectModel')}
              disabled={isRejected || !brand || brandOther}
              hint={!brand || brandOther ? t('partner.vehicle.selectBrandFirst') : undefined}
              onPress={() => setModelSheet(true)}
              icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
            />
            {(modelOther || brandOther) && (
              <Field theme={theme} label={t('partner.vehicle.modelFree')} value={model} onChangeText={setModel} placeholder="Corolla, Clio…" editable={!isRejected} icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
            )}

            <Field theme={theme} label={t('partner.field.color')} value={color} onChangeText={setColor} placeholder="Beyaz, Siyah…" editable={!isRejected} icon={<Palette size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />

            {/* Make picker sheet */}
            <PickerSheet
              theme={theme}
              accent={ACCENT}
              visible={makeSheet}
              title={t('partner.vehicle.selectBrand')}
              searchPlaceholder={t('partner.vehicle.search')}
              otherLabel={t('partner.vehicle.other')}
              options={makes.map((m) => m.name)}
              onClose={() => setMakeSheet(false)}
              onSelect={(name) => {
                setBrand(name);
                setBrandOther(false);
                setModel('');
                setModelOther(false);
                setMakeSheet(false);
              }}
              onOther={() => {
                setBrandOther(true);
                setBrand('');
                setModel('');
                setModelOther(true);
                setMakeSheet(false);
              }}
            />

            {/* Model picker sheet */}
            <PickerSheet
              theme={theme}
              accent={ACCENT}
              visible={modelSheet}
              title={t('partner.vehicle.selectModel')}
              searchPlaceholder={t('partner.vehicle.search')}
              otherLabel={t('partner.vehicle.other')}
              options={models.map((m) => m.name)}
              onClose={() => setModelSheet(false)}
              onSelect={(name) => {
                setModel(name);
                setModelOther(false);
                setModelSheet(false);
              }}
              onOther={() => {
                setModelOther(true);
                setModel('');
                setModelSheet(false);
              }}
            />
          </>
        )}

        {/* ── PAYLOAD: BUSINESS (market / restaurant) ── */}
        {isBusiness && (
          <>
            <SectionTitle theme={theme} accent={ACCENT}>{t('partner.section.business')}</SectionTitle>

            <Field theme={theme} label={t('partner.field.businessName')} value={businessName} onChangeText={setBusinessName} placeholder={t('partner.field.businessNamePlaceholder')} editable={!isRejected} icon={<Building2 size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
            <Field theme={theme} label={t('partner.field.category')} value={category} onChangeText={setCategory} placeholder={t(`partner.field.categoryPlaceholder.${appType}`)} editable={!isRejected} icon={<Tag size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
            <Field theme={theme} label={t('partner.field.address')} value={address} onChangeText={setAddress} placeholder={t('partner.field.addressPlaceholder')} autoCapitalize="sentences" editable={!isRejected} icon={<MapPin size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
            <Field theme={theme} label={t('partner.field.phone')} value={phone} onChangeText={setPhone} placeholder="+90 …" autoCapitalize="none" editable={!isRejected} icon={<Phone size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />

            {/* Map pin */}
            <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 6 }}>
              {t('partner.field.location')}<Text style={{ color: theme.colors.error }}> *</Text>
            </Text>
            <TouchableOpacity
              activeOpacity={isRejected ? 1 : 0.85}
              onPress={isRejected || locLoading ? undefined : onUseMyLocation}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                backgroundColor: styles.accentSoft, borderRadius: theme.radius.lg,
                borderWidth: 1.5, borderColor: ACCENT + '55', borderStyle: 'dashed',
                paddingVertical: 16, opacity: isRejected ? 0.5 : 1, marginBottom: coords ? 8 : 4,
              }}
            >
              {locLoading ? <ActivityIndicator color={ACCENT} /> : <Navigation size={18} color={ACCENT} strokeWidth={1.8} />}
              <Text style={{ ...theme.typography.labelMd, color: ACCENT }}>{t('partner.business.useMyLocation')}</Text>
            </TouchableOpacity>

            {coords && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 }}>
                <CheckCircle2 size={16} color={theme.colors.success} strokeWidth={2} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                  {t('partner.business.captured', { lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) })}
                </Text>
              </View>
            )}
            {!!locError && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.error, marginBottom: 12 }}>{locError}</Text>
            )}
          </>
        )}

        {/* ── SELFIE (driver only) ── */}
        {isDriver && (
          <>
            <View style={{ height: 8 }} />
            <SectionTitle theme={theme} accent={ACCENT}>{t('partner.section.selfie')}</SectionTitle>
            <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginBottom: 12 }}>
              {t('partner.selfie.hint.driver')}
            </Text>
            <PhotoPicker
              theme={theme}
              accent={ACCENT}
              accentSoft={styles.accentSoft}
              url={selfieUrl}
              uploading={selfieUploading}
              disabled={isRejected}
              onPick={onPickSelfie}
              label={t('partner.selfie.cta')}
              icon={<Camera size={22} color={ACCENT} strokeWidth={1.8} />}
              rounded
            />
          </>
        )}

        {/* ── DOCUMENTS ── */}
        <View style={{ height: 8 }} />
        <SectionTitle theme={theme} accent={ACCENT}>{t('partner.section.documents')}</SectionTitle>

        {requirements.length === 0 && (
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textTertiary, marginBottom: 12 }}>
            {t('partner.documents.empty')}
          </Text>
        )}

        {requirements.map((req) => {
          const ds = docs[req.key] || { fileUrl: '', number: '', expiry: '', uploading: false };
          const editable = isDocEditable(req.key);
          const appDoc = application?.documents.find((d) => d.requirementKey === req.key);
          const rejected = appDoc?.status === 'rejected';
          const label = pickI18n(req.i18n, language);
          return (
            <View
              key={req._id || req.key}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: rejected ? theme.colors.error : theme.colors.borderDefault,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary, flex: 1 }}>
                  {label}{req.required ? <Text style={{ color: theme.colors.error }}> *</Text> : null}
                </Text>
                {appDoc && <DocStatusBadge theme={theme} status={appDoc.status} t={t} />}
              </View>

              {rejected && !!appDoc?.rejectReason && (
                <View style={{ flexDirection: 'row', gap: 8, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radius.sm, padding: 10, marginBottom: 10 }}>
                  <AlertCircle size={14} color={theme.colors.error} strokeWidth={2} />
                  <Text style={{ flex: 1, ...theme.typography.caption, color: theme.colors.error }}>{appDoc.rejectReason}</Text>
                </View>
              )}

              {req.file && (
                <PhotoPicker
                  theme={theme}
                  accent={ACCENT}
                  accentSoft={styles.accentSoft}
                  url={ds.fileUrl}
                  uploading={ds.uploading}
                  disabled={!editable}
                  onPick={() => onPickDoc(req.key)}
                  label={t('partner.documents.upload')}
                  icon={<ImageUp size={20} color={ACCENT} strokeWidth={1.8} />}
                />
              )}

              {req.number && (
                <View style={{ marginTop: 12 }}>
                  <Field
                    theme={theme}
                    label={pickI18n(req.numberLabel, language) || t('partner.documents.number')}
                    value={ds.number}
                    onChangeText={(v) => setDocField(req.key, 'number', v)}
                    editable={editable}
                    icon={<Hash size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
                  />
                </View>
              )}

              {req.expiry && (
                <View style={{ marginTop: 12 }}>
                  <Field
                    theme={theme}
                    label={t('partner.documents.expiry')}
                    value={ds.expiry}
                    onChangeText={(v) => setDocField(req.key, 'expiry', v)}
                    editable={editable}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    icon={<Calendar size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* validation hints */}
        {!isRejected && !canSubmit && (
          <View style={{ gap: 4, marginBottom: 12 }}>
            {!payloadValid && <HintRow theme={theme} text={t(isDriver ? 'partner.hint.vehicle' : 'partner.hint.business')} />}
            {!selfieOk && <HintRow theme={theme} text={t('partner.hint.selfie')} />}
            {!requiredDocsFilled && <HintRow theme={theme} text={t('partner.hint.documents')} />}
          </View>
        )}

        {!!submitError && (
          <Text style={{ color: theme.colors.error, ...theme.typography.bodyMd, textAlign: 'center', marginBottom: 12 }}>{submitError}</Text>
        )}

        {/* submit / resubmit */}
        {isRejected ? (
          <TouchableOpacity
            onPress={onResubmit}
            disabled={submitting || !rejectedDocsReady}
            style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: theme.radius.xl, paddingVertical: 16, opacity: submitting || !rejectedDocsReady ? 0.5 : 1 }}
          >
            <RefreshCw size={18} color={theme.colors.textInverse} strokeWidth={2} />
            <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
              {submitting ? t('partner.submitting') : t('partner.resubmit')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: theme.radius.xl, paddingVertical: 16, opacity: !canSubmit ? 0.5 : 1 }}
          >
            <CheckCircle2 size={18} color={theme.colors.textInverse} strokeWidth={2} />
            <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
              {submitting ? t('partner.submitting') : t('partner.submit')}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, textAlign: 'center', marginTop: 16 }}>
          {t('partner.footerNote')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ theme, accent, children }: { theme: any; accent: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>{children}</Text>
    </View>
  );
}

function Field({
  theme, label, value, onChangeText, placeholder, autoCapitalize = 'words', icon, editable = true,
}: {
  theme: any; label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  icon: React.ReactNode; editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg,
        paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.borderDefault,
        opacity: editable ? 1 : 0.6,
      }}>
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize={autoCapitalize}
          editable={editable}
          style={{ flex: 1, ...theme.typography.bodyMd, color: theme.colors.textPrimary, paddingVertical: 12 }}
        />
      </View>
    </View>
  );
}

function SelectorButton({
  theme, accent, label, value, placeholder, hint, disabled, onPress, icon,
}: {
  theme: any; accent: string; label: string; value: string; placeholder: string;
  hint?: string; disabled?: boolean; onPress: () => void; icon: React.ReactNode;
}) {
  const filled = !!value;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.8}
        onPress={disabled ? undefined : onPress}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg,
          paddingHorizontal: 14, paddingVertical: 14,
          borderWidth: 1, borderColor: filled ? accent + '66' : theme.colors.borderDefault,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon}
        <Text
          numberOfLines={1}
          style={{
            flex: 1, ...theme.typography.bodyMd,
            color: filled ? theme.colors.textPrimary : theme.colors.textTertiary,
          }}
        >
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={disabled ? theme.colors.textTertiary : accent} strokeWidth={2} />
      </TouchableOpacity>
      {!!hint && disabled && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginTop: 5 }}>{hint}</Text>
      )}
    </View>
  );
}

function PickerSheet({
  theme, accent, visible, title, searchPlaceholder, otherLabel, options, onClose, onSelect, onOther,
}: {
  theme: any; accent: string; visible: boolean; title: string; searchPlaceholder: string;
  otherLabel: string; options: string[]; onClose: () => void;
  onSelect: (name: string) => void; onOther: () => void;
}) {
  const [query, setQuery] = useState('');

  // Reset the search field each time the sheet opens.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' }}>
        {/* tap-to-dismiss backdrop */}
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            maxHeight: '78%',
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderTopWidth: 1,
            borderColor: theme.colors.borderDefault,
            paddingTop: 10,
            overflow: 'hidden',
          }}
        >
          {/* grabber */}
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderDefault, marginBottom: 12 }} />

          {/* header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={theme.colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* search */}
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg,
              paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.borderDefault,
            }}>
              <Search size={16} color={theme.colors.textTertiary} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, ...theme.typography.bodyMd, color: theme.colors.textPrimary, paddingVertical: 11 }}
              />
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, i) => `${item}-${i}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 28 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelect(item)}
                style={{
                  paddingHorizontal: 20, paddingVertical: 15,
                  borderBottomWidth: 1, borderBottomColor: theme.colors.borderDefault + '55',
                }}
              >
                <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textPrimary }}>{item}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onOther}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 20, paddingVertical: 16,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
                <Text style={{ ...theme.typography.labelMd, color: accent, fontWeight: '700' }}>{otherLabel}</Text>
              </TouchableOpacity>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

function PhotoPicker({
  theme, accent, accentSoft, url, uploading, disabled, onPick, label, icon, rounded,
}: {
  theme: any; accent: string; accentSoft: string; url: string; uploading: boolean;
  disabled?: boolean; onPick: () => void; label: string; icon: React.ReactNode; rounded?: boolean;
}) {
  if (url) {
    return (
      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.85}
        onPress={disabled ? undefined : onPick}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 12, borderWidth: 1, borderColor: theme.colors.borderDefault }}
      >
        <Image source={{ uri: url }} style={{ width: 56, height: 56, borderRadius: rounded ? 28 : theme.radius.md, backgroundColor: theme.colors.surface }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={16} color={theme.colors.success} strokeWidth={2} />
          <Text style={{ ...theme.typography.labelMd, color: theme.colors.success }}>{label}</Text>
        </View>
        {uploading ? <ActivityIndicator color={accent} /> : null}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled || uploading ? undefined : onPick}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: accentSoft, borderRadius: theme.radius.lg,
        borderWidth: 1.5, borderColor: accent + '55', borderStyle: 'dashed',
        paddingVertical: 18, opacity: disabled ? 0.5 : 1,
      }}
    >
      {uploading ? <ActivityIndicator color={accent} /> : icon}
      <Text style={{ ...theme.typography.labelMd, color: accent }}>{uploading ? '' : label}</Text>
    </TouchableOpacity>
  );
}

function DocStatusBadge({ theme, status, t }: { theme: any; status: 'pending' | 'verified' | 'rejected'; t: (k: string) => string }) {
  const map = {
    pending: { bg: theme.colors.warningSoft, fg: theme.colors.warning, label: t('partner.docStatus.pending') },
    verified: { bg: theme.colors.successSoft, fg: theme.colors.success, label: t('partner.docStatus.verified') },
    rejected: { bg: theme.colors.errorSoft, fg: theme.colors.error, label: t('partner.docStatus.rejected') },
  }[status];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: map.bg }}>
      <Text style={{ ...theme.typography.caption, color: map.fg, fontWeight: '700' }}>{map.label}</Text>
    </View>
  );
}

function HintRow({ theme, text }: { theme: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <AlertCircle size={13} color={theme.colors.textTertiary} strokeWidth={2} />
      <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}>{text}</Text>
    </View>
  );
}
