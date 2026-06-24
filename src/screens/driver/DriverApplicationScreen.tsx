// src/screens/driver/DriverApplicationScreen.tsx
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
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
} from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n';
import { useRegion } from '../../store/useRegion';
import {
  getDriverRequirements,
  getMyDriverApplication,
  submitDriverApplication,
  resubmitDriverApplication,
  uploadToCloud,
  type DriverDocRequirement,
  type DriverApplication,
  type SubmitPayload,
  type DriverI18n,
} from '../../api/driverApplication.api';

type VehicleType = 'sedan' | 'van' | 'luxury' | 'pet';

const VEHICLE_TYPES: { value: VehicleType; emoji: string; labelKey: string }[] = [
  { value: 'sedan', emoji: '🚗', labelKey: 'driverApplication.vehicleType.sedan' },
  { value: 'van', emoji: '🚐', labelKey: 'driverApplication.vehicleType.van' },
  { value: 'luxury', emoji: '🚙', labelKey: 'driverApplication.vehicleType.luxury' },
  { value: 'pet', emoji: '🐾', labelKey: 'driverApplication.vehicleType.pet' },
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

export default function DriverApplicationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);

  const ACCENT = theme.driver.main;
  const ACCENT_SOFT = theme.driver.light;
  const countryCode = useMemo(() => regionToCountryCode(region), [region]);

  // ─── data ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [requirements, setRequirements] = useState<DriverDocRequirement[]>([]);

  // ─── form state ────────────────────────────────────────────────────────────
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');

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
        getMyDriverApplication(),
        getDriverRequirements(countryCode),
      ]);
      setApplication(app);
      setRequirements((reqs || []).slice().sort((a, b) => a.order - b.order));

      if (app) {
        setPlate(app.vehicle?.plate || '');
        setBrand(app.vehicle?.brand || '');
        setModel(app.vehicle?.model || '');
        setColor(app.vehicle?.color || '');
        setVehicleType((app.vehicle?.type as VehicleType) || 'sedan');
        setSelfieUrl(app.selfieUrl || '');
        const seeded: Record<string, DocState> = {};
        (app.documents || []).forEach((d) => {
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
      setLoadError(e?.response?.data?.message || e?.message || t('driverApplication.error.load'));
    } finally {
      setLoading(false);
    }
  }, [countryCode, t]);

  useEffect(() => {
    load();
  }, [load]);

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

  // ─── image pick + upload ────────────────────────────────────────────────────
  const pickImage = useCallback(async (): Promise<{ uri: string; name: string; type: string } | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return {
      uri: a.uri,
      name: (a as any).fileName || `upload-${Date.now()}.jpg`,
      type: (a as any).mimeType || 'image/jpeg',
    };
  }, []);

  const onPickSelfie = useCallback(async () => {
    try {
      const file = await pickImage();
      if (!file) return;
      setSelfieUploading(true);
      const url = await uploadToCloud(file);
      setSelfieUrl(url);
      Haptics.selectionAsync();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('driverApplication.error.upload'));
    } finally {
      setSelfieUploading(false);
    }
  }, [pickImage, t]);

  const onPickDoc = useCallback(
    async (key: string) => {
      try {
        const file = await pickImage();
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
        setSubmitError(e?.response?.data?.message || e?.message || t('driverApplication.error.upload'));
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
  const vehicleValid = !!(plate.trim() && brand.trim() && model.trim() && color.trim());
  const requiredDocsFilled = requirements
    .filter((r) => r.required && r.file)
    .every((r) => !!docs[r.key]?.fileUrl);
  const canSubmit = vehicleValid && !!selfieUrl && requiredDocsFilled && !submitting;

  const buildDocsPayload = useCallback((): SubmitPayload['documents'] => {
    return requirements
      .filter((r) => !!docs[r.key]?.fileUrl)
      .map((r) => {
        const d = docs[r.key];
        const out: SubmitPayload['documents'][number] = {
          requirementKey: r.key,
          fileUrl: d.fileUrl,
        };
        if (r.number && d.number.trim()) out.number = d.number.trim();
        if (r.expiry) out.expiry = d.expiry.trim() ? d.expiry.trim() : null;
        return out;
      });
  }, [requirements, docs]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: SubmitPayload = {
        countryCode,
        vehicle: {
          plate: plate.trim().toUpperCase(),
          brand: brand.trim(),
          model: model.trim(),
          color: color.trim(),
          type: vehicleType,
        },
        selfieUrl,
        documents: buildDocsPayload(),
      };
      const updated = await submitDriverApplication(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApplication(updated);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('driverApplication.error.submit'));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, countryCode, plate, brand, model, color, vehicleType, selfieUrl, buildDocsPayload, t]);

  const onResubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // sadece reddedilen (yeniden yüklenebilir) belgeleri gönder
      const changed = requirements
        .filter((r) => isDocEditable(r.key) && !!docs[r.key]?.fileUrl)
        .map((r) => {
          const d = docs[r.key];
          const out: SubmitPayload['documents'][number] = { requirementKey: r.key, fileUrl: d.fileUrl };
          if (r.number && d.number.trim()) out.number = d.number.trim();
          if (r.expiry) out.expiry = d.expiry.trim() ? d.expiry.trim() : null;
          return out;
        });
      const updated = await resubmitDriverApplication(changed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApplication(updated);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || e?.message || t('driverApplication.error.submit'));
    } finally {
      setSubmitting(false);
    }
  }, [requirements, isDocEditable, docs, t]);

  const rejectedDocsReady = requirements
    .filter((r) => isDocEditable(r.key))
    .every((r) => !!docs[r.key]?.fileUrl);

  // ─── render helpers ─────────────────────────────────────────────────────────
  const styles = useMemo(() => ({ accent: ACCENT, accentSoft: ACCENT_SOFT }), [ACCENT, ACCENT_SOFT]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginTop: 12 }}>
          {t('driverApplication.loading')}
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
          <Text style={{ ...theme.typography.labelMd, color: theme.colors.textInverse }}>{t('driverApplication.retry')}</Text>
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
          {t('driverApplication.approved.title')}
        </Text>
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
          {t('driverApplication.approved.body')}
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
          {t('driverApplication.pending.title')}
        </Text>
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
          {t('driverApplication.pending.body')}
        </Text>
        {!!application?.createdAt && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}>
            {t('driverApplication.submittedAt', { date: new Date(application.createdAt).toLocaleDateString() })}
          </Text>
        )}
      </View>
    );
  }

  // ── EDITABLE (no app / draft / rejected) ───────────────────────────────────
  const headerTitle = isRejected ? t('driverApplication.rejected.title') : t('driverApplication.title');
  const headerSub = isRejected ? t('driverApplication.rejected.body') : t('driverApplication.subtitle');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 16, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 24, gap: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: styles.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            {isRejected ? <XCircle size={34} color={theme.colors.error} strokeWidth={1.5} /> : <Car size={34} color={ACCENT} strokeWidth={1.5} />}
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

        {/* ── VEHICLE ── */}
        <SectionTitle theme={theme} accent={ACCENT}>{t('driverApplication.section.vehicle')}</SectionTitle>

        <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 8 }}>
          {t('driverApplication.field.vehicleType')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {VEHICLE_TYPES.map((vt) => {
            const active = vehicleType === vt.value;
            return (
              <TouchableOpacity
                key={vt.value}
                disabled={isReadOnly || isRejected}
                onPress={() => setVehicleType(vt.value)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderRadius: theme.radius.lg, borderWidth: 1.5,
                  borderColor: active ? ACCENT : theme.colors.borderDefault,
                  backgroundColor: active ? styles.accentSoft : theme.colors.surface,
                  opacity: isRejected ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 16 }}>{vt.emoji}</Text>
                <Text style={{ ...theme.typography.labelMd, color: active ? ACCENT : theme.colors.textSecondary }}>{t(vt.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field theme={theme} label={t('driverApplication.field.plate')} value={plate} onChangeText={setPlate} placeholder="34 ABC 123" autoCapitalize="characters" editable={!isRejected} icon={<Hash size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
        <Field theme={theme} label={t('driverApplication.field.brand')} value={brand} onChangeText={setBrand} placeholder="Toyota, Renault…" editable={!isRejected} icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
        <Field theme={theme} label={t('driverApplication.field.model')} value={model} onChangeText={setModel} placeholder="Corolla, Clio…" editable={!isRejected} icon={<Car size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />
        <Field theme={theme} label={t('driverApplication.field.color')} value={color} onChangeText={setColor} placeholder="Beyaz, Siyah…" editable={!isRejected} icon={<Palette size={16} color={theme.colors.textTertiary} strokeWidth={2} />} />

        {/* ── SELFIE ── */}
        <View style={{ height: 8 }} />
        <SectionTitle theme={theme} accent={ACCENT}>{t('driverApplication.section.selfie')}</SectionTitle>
        <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginBottom: 12 }}>
          {t('driverApplication.selfie.hint')}
        </Text>
        <PhotoPicker
          theme={theme}
          accent={ACCENT}
          accentSoft={styles.accentSoft}
          url={selfieUrl}
          uploading={selfieUploading}
          disabled={isRejected}
          onPick={onPickSelfie}
          label={t('driverApplication.selfie.cta')}
          icon={<Camera size={22} color={ACCENT} strokeWidth={1.8} />}
          rounded
        />

        {/* ── DOCUMENTS ── */}
        <View style={{ height: 8 }} />
        <SectionTitle theme={theme} accent={ACCENT}>{t('driverApplication.section.documents')}</SectionTitle>

        {requirements.length === 0 && (
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textTertiary, marginBottom: 12 }}>
            {t('driverApplication.documents.empty')}
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
                  label={t('driverApplication.documents.upload')}
                  icon={<ImageUp size={20} color={ACCENT} strokeWidth={1.8} />}
                />
              )}

              {req.number && (
                <View style={{ marginTop: 12 }}>
                  <FieldInline
                    theme={theme}
                    label={pickI18n(req.numberLabel, language) || t('driverApplication.documents.number')}
                    value={ds.number}
                    onChangeText={(v) => setDocField(req.key, 'number', v)}
                    editable={editable}
                    icon={<Hash size={16} color={theme.colors.textTertiary} strokeWidth={2} />}
                  />
                </View>
              )}

              {req.expiry && (
                <View style={{ marginTop: 12 }}>
                  <FieldInline
                    theme={theme}
                    label={t('driverApplication.documents.expiry')}
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
            {!vehicleValid && <HintRow theme={theme} text={t('driverApplication.hint.vehicle')} />}
            {!selfieUrl && <HintRow theme={theme} text={t('driverApplication.hint.selfie')} />}
            {!requiredDocsFilled && <HintRow theme={theme} text={t('driverApplication.hint.documents')} />}
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
              {submitting ? t('driverApplication.submitting') : t('driverApplication.resubmit')}
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
              {submitting ? t('driverApplication.submitting') : t('driverApplication.submit')}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, textAlign: 'center', marginTop: 16 }}>
          {t('driverApplication.footerNote')}
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

function FieldInline(props: React.ComponentProps<typeof Field>) {
  return <Field {...props} />;
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
    pending: { bg: theme.colors.warningSoft, fg: theme.colors.warning, label: t('driverApplication.docStatus.pending') },
    verified: { bg: theme.colors.successSoft, fg: theme.colors.success, label: t('driverApplication.docStatus.verified') },
    rejected: { bg: theme.colors.errorSoft, fg: theme.colors.error, label: t('driverApplication.docStatus.rejected') },
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
