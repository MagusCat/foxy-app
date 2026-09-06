import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GradeDial } from '@/components/grade-dial';
import { MonthCalendar } from '@/components/month-calendar';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { formatShortDate, type StudyPlan } from '@/hooks/use-study-plans';

type View_ = 'info' | 'config' | 'title' | 'grade' | 'date';

type PlanSettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
  plan: StudyPlan;
  onUpdate: (patch: Partial<StudyPlan>) => void;
  onDelete: () => void;
  onOpenSources: () => void;
};

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      className="mb-2.5 flex-row items-center rounded-2xl border px-4 py-3.5"
      style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
    >
      <View className="flex-1 pr-3">
        <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
          {label}
        </Text>
        <Text
          className="mt-1 text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark"
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.icon} />
    </TouchableOpacity>
  );
}

export function PlanSettingsSheet({
  visible,
  onClose,
  plan,
  onUpdate,
  onDelete,
  onOpenSources,
}: PlanSettingsSheetProps) {
  const { colors, isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [view, setView] = useState<View_>('info');
  const [titleDraft, setTitleDraft] = useState(plan.title);
  const [isDialActive, setDialActive] = useState(false);

  useEffect(() => {
    if (visible) return;
    setView('info');
    setDialActive(false);
  }, [visible]);

  const accent = getSubjectAccent(plan.subject, isDark);

  const back = () => setView(view === 'info' || view === 'config' ? 'info' : 'config');

  const handleDelete = () =>
    appAlert('Eliminar preparación de examen', `¿Eliminar "${plan.title}" y todos sus datos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onDelete },
    ]);

  const title =
    view === 'info'
      ? ''
      : view === 'config'
        ? 'Configuración'
        : view === 'title'
          ? 'Título de la preparación'
          : view === 'grade'
            ? 'Calificación objetivo'
            : 'Fecha del examen';

  return (
    <AppModal visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />

        <SheetSlide>
          <View
            className="max-h-[90%] rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
          <View className="mb-4 flex-row items-center">
            {view === 'info' ? (
              <View className="h-[34px] w-[34px]" />
            ) : (
              <TouchableOpacity
                className="h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
                accessibilityLabel="Volver"
                onPress={back}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
            )}

            <Text className="flex-1 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {title}
            </Text>

            <TouchableOpacity
              className="h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surface }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isDialActive}
          >
            {view === 'info' ? (
              <>
                <View className="mb-5 flex-row items-center">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full border"
                    style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
                  >
                    <Text className="text-[16px] font-bold text-text-primary-light dark:text-text-primary-dark">
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="ml-3">
                    <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                      Creado por
                    </Text>
                    <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {userName} (tú)
                    </Text>
                  </View>
                </View>

                <View
                  className="mb-4 rounded-[20px] p-4"
                  style={{ backgroundColor: accent.soft }}
                >
                  <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                    {plan.subject}
                  </Text>
                  <Text className="mt-1.5 text-[24px] font-bold leading-[31px] text-text-primary-light dark:text-text-primary-dark">
                    {plan.title}
                  </Text>
                  <Text className="mt-4 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {plan.materials.length}{' '}
                    {plan.materials.length === 1 ? 'archivo de estudio' : 'archivos de estudio'} ·{' '}
                    {plan.language}
                  </Text>
                </View>

                <View
                  className="rounded-2xl border"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                >
                  <TouchableOpacity
                    className="flex-row items-center p-4"
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Fuentes. Ver o agregar más"
                    onPress={onOpenSources}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons name="folder-outline" size={19} color={colors.text} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                        Fuentes
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                        Ver o agregar más
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View className="ml-[68px] h-px" style={{ backgroundColor: colors.cardBorder }} />

                  <TouchableOpacity
                    className="flex-row items-center p-4"
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Configuración de la preparación"
                    onPress={() => setView('config')}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons name="settings-outline" size={19} color={colors.text} />
                    </View>
                    <Text className="ml-3 flex-1 text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      Configuración
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {view === 'config' ? (
              <>
                <SettingRow
                  label="Título de la preparación"
                  value={plan.title}
                  onPress={() => {
                    setTitleDraft(plan.title);
                    setView('title');
                  }}
                />
                <SettingRow
                  label="Calificación objetivo"
                  value={`${plan.targetGrade}%`}
                  onPress={() => setView('grade')}
                />
                <SettingRow
                  label="Fecha del examen"
                  value={formatShortDate(plan.examDate)}
                  onPress={() => setView('date')}
                />

                <View
                  className="mb-2.5 mt-2 flex-row items-center rounded-2xl border p-4"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      Ocultar de otros
                    </Text>
                    <Text className="mt-1 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                      Oculta esta preparación para examen para que otros no puedan crear una copia.
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(plan.hidden)}
                    onValueChange={(hidden) => onUpdate({ hidden })}
                    trackColor={{ false: isDark ? '#2D2D3A' : '#D1D5DB', true: Palette.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View
                  className="flex-row items-center rounded-2xl border p-4"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      ¿Eliminar preparación de examen?
                    </Text>
                    <Text className="mt-1 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                      Esto eliminará permanentemente esta preparación de examen y todos sus datos.
                    </Text>
                  </View>

                  <TouchableOpacity
                    className="flex-row items-center rounded-full border px-3.5 py-2.5"
                    style={{ borderColor: '#EF4444' }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Eliminar preparación de examen"
                    onPress={handleDelete}
                  >
                    <Ionicons name="exit-outline" size={15} color="#EF4444" />
                    <Text className="ml-1.5 text-[13px] font-semibold" style={{ color: '#EF4444' }}>
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {view === 'title' ? (
              <>
                <TextInput
                  className="rounded-2xl border px-4 py-3.5 text-[15px] text-text-primary-light dark:text-text-primary-dark"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder="Ej. Planteamiento de problemas"
                  placeholderTextColor={colors.icon}
                  maxLength={90}
                  autoFocus
                  returnKeyType="done"
                />
                <TouchableOpacity
                  className="mt-4 items-center rounded-[18px] py-4"
                  style={{ backgroundColor: Palette.primary, opacity: titleDraft.trim() ? 1 : 0.45 }}
                  activeOpacity={0.85}
                  disabled={!titleDraft.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Guardar título"
                  onPress={() => {
                    onUpdate({ title: titleDraft.trim() });
                    setView('config');
                  }}
                >
                  <Text className="text-[15px] font-bold text-white">Guardar</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {view === 'grade' ? (
              <View className="items-center pb-2">
                <GradeDial
                  value={plan.targetGrade}
                  onChange={(targetGrade) => onUpdate({ targetGrade })}
                  color={accent.color}
                  size={210}
                  onDragChange={setDialActive}
                />
                <TouchableOpacity
                  className="mt-6 w-full items-center rounded-[18px] py-4"
                  style={{ backgroundColor: Palette.primary }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Listo"
                  onPress={() => setView('config')}
                >
                  <Text className="text-[15px] font-bold text-white">Listo</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {view === 'date' ? (
              <>
                <MonthCalendar
                  selectedDay={plan.examDate}
                  onSelectDay={(examDate) => onUpdate({ examDate })}
                  disablePast
                  accent={Palette.primary}
                />
                <TouchableOpacity
                  className="mt-4 items-center rounded-[18px] py-4"
                  style={{ backgroundColor: Palette.primary }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Listo"
                  onPress={() => setView('config')}
                >
                  <Text className="text-[15px] font-bold text-white">Listo</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>
          </View>
        </SheetSlide>
      </View>
    </AppModal>
  );
}
