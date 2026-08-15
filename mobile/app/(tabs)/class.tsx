import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { TabHeader, useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { getSubjectAccent } from '@/constants/subject-colors';
import { mergeSubjects } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { generateRoomCode, useClassrooms, type Classroom } from '@/hooks/use-classrooms';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { formatTime12 } from '@/lib/time';

export type { Classroom } from '@/hooks/use-classrooms';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const EMPTY_FORM = { name: '', subject: '', teacher: '', days: [] as string[], time: '' };

function composeSchedule(days: string[], time: string) {
  if (days.length === 0 && !time) return '';

  const ordered = DAYS.filter((day) => days.includes(day));
  const label =
    ordered.length === 0
      ? ''
      : ordered.length === 1
        ? ordered[0]
        : `${ordered.slice(0, -1).join(', ')} y ${ordered[ordered.length - 1]}`;

  if (!time) return label;
  return label ? `${label} · ${formatTime12(time)}` : formatTime12(time);
}

export default function ClassScreen() {
  const padding = useScreenPadding();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const { rooms, setRooms } = useClassrooms();
  const [savedSubjects] = usePersistentState<string[]>('foxy:subjects', []);
  const catalog = useMemo(() => mergeSubjects(savedSubjects).slice(0, 18), [savedSubjects]);

  const [isFormVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isTimeVisible, setTimeVisible] = useState(false);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEditForm = (room: Classroom) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      subject: room.subject,
      teacher: room.teacher,
      days: DAYS.filter((day) => room.schedule.includes(day)),
      time: '',
    });
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const toggleDay = (day: string) =>
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((item) => item !== day) : [...prev.days, day],
    }));

  const handleSubmit = () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Falta el nombre', 'Ponle un nombre a tu salón para poder guardarlo.');
      return;
    }

    const duplicated = rooms.some(
      (room) => room.id !== editingId && room.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicated) {
      Alert.alert('Salón duplicado', 'Ya tienes un salón con ese nombre.');
      return;
    }

    const details = {
      name,
      subject: form.subject.trim(),
      teacher: form.teacher.trim(),
      schedule: composeSchedule(form.days, form.time),
    };

    if (editingId) {
      setRooms(rooms.map((room) => (room.id === editingId ? { ...room, ...details } : room)));
    } else {
      const created: Classroom = {
        id: `${Date.now()}`,
        code: generateRoomCode(),
        posts: [],
        ...details,
      };
      setRooms([created, ...rooms]);
      closeForm();
      setTimeout(() => router.push({ pathname: '/class/[id]', params: { id: created.id } }), 260);
      return;
    }

    closeForm();
  };

  const handleDelete = (room: Classroom) => {
    Alert.alert(
      'Eliminar salón',
      `¿Seguro que quieres eliminar "${room.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => setRooms(rooms.filter((item) => item.id !== room.id)),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.tabBottom }}
        showsVerticalScrollIndicator={false}
      >
        <TabHeader
          title="Clase"
          subtitle={
            rooms.length > 0
              ? `${rooms.length} ${rooms.length === 1 ? 'salón' : 'salones'}`
              : 'Organiza tus materias en salones'
          }
          right={
            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-[20px]"
              style={{
                elevation: 6,
                shadowColor: Palette.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isDark ? 0.5 : 0.25,
                shadowRadius: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel="Crear salón"
              onPress={openCreateForm}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: Palette.primary,
                }}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text className="text-[13px] font-bold text-white">Crear salón</Text>
              </View>
            </TouchableOpacity>
          }
        />

        {rooms.length === 0 ? (
          <View
            className="items-center rounded-[24px] border px-6 py-10"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: softTint(Palette.primary, isDark) }}
            >
              <Text className="text-3xl">🦊</Text>
            </View>
            <Text className="mb-2 text-center text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              Aún no tienes salones
            </Text>
            <Text className="mb-5 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
              Crea un salón para agrupar tus apuntes, tareas y anuncios por materia. Foxy los usará
              para darte ayuda más precisa.
            </Text>
            <TouchableOpacity
              className="flex-row items-center rounded-2xl px-5 py-3"
              style={{ backgroundColor: Palette.primary }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Crear mi primer salón"
              onPress={openCreateForm}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text className="text-[13px] font-semibold text-white">Crear mi primer salón</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mt-2">
            {rooms.map((room) => {
              const accent = getSubjectAccent(room.subject || room.name, isDark);
              const meta = [room.subject, room.teacher].filter(Boolean).join(' · ');
              const pending = (room.posts ?? []).filter((post) => post.kind === 'tarea').length;

              return (
                <TouchableOpacity
                  key={room.id}
                  className="mb-3 overflow-hidden rounded-[20px] border"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Entrar a ${room.name}`}
                  onPress={() => router.push({ pathname: '/class/[id]', params: { id: room.id } })}
                >
                  <View style={{ height: 4, backgroundColor: accent.color }} />

                  <View className="p-4">
                    <View className="flex-row items-start">
                      <View className="flex-1 pr-2">
                        <Text
                          className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
                          numberOfLines={1}
                        >
                          {room.name}
                        </Text>
                        {meta ? (
                          <Text
                            className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
                            numberOfLines={1}
                          >
                            {meta}
                          </Text>
                        ) : null}
                      </View>

                      <View className="flex-row items-center gap-1">
                        <TouchableOpacity
                          className="h-9 w-9 items-center justify-center rounded-full"
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Editar ${room.name}`}
                          onPress={() => openEditForm(room)}
                        >
                          <Ionicons name="pencil-outline" size={17} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="h-9 w-9 items-center justify-center rounded-full"
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Eliminar ${room.name}`}
                          onPress={() => handleDelete(room)}
                        >
                          <Ionicons name="trash-outline" size={17} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center">
                      {room.schedule ? (
                        <View className="flex-row items-center">
                          <Ionicons name="time-outline" size={13} color={colors.icon} />
                          <Text className="ml-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {room.schedule}
                          </Text>
                        </View>
                      ) : null}

                      {pending > 0 ? (
                        <View
                          className="ml-2 rounded-full px-2 py-0.5"
                          style={{ backgroundColor: softTint('#F97316', isDark) }}
                        >
                          <Text className="text-[10px] font-bold" style={{ color: '#F97316' }}>
                            {pending} {pending === 1 ? 'tarea' : 'tareas'}
                          </Text>
                        </View>
                      ) : null}

                      <View className="flex-1" />

                      <View
                        className="flex-row items-center rounded-full px-2.5 py-1"
                        style={{ backgroundColor: accent.soft }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: accent.color }}>
                          Entrar
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={12}
                          color={accent.color}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={isFormVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={closeForm}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeForm} />
          <View
            className="max-h-[88%] rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {editingId ? 'Editar salón' : 'Nuevo salón'}
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={closeForm}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Nombre del salón *
              </Text>
              <TextInput
                className="mb-4 rounded-[14px] border px-3.5 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark"
                style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                placeholder="Ej. Matemáticas 3ºB"
                placeholderTextColor={colors.icon}
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                autoFocus
              />

              <Text className="mb-2 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Materia
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {catalog.map((subject) => {
                  const isSelected = form.subject === subject;
                  const accent = getSubjectAccent(subject, isDark);
                  return (
                    <TouchableOpacity
                      key={subject}
                      className="rounded-2xl border-[1.5px] px-3 py-2"
                      style={{
                        borderColor: isSelected ? accent.color : colors.cardBorder,
                        backgroundColor: isSelected ? accent.soft : colors.background,
                      }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, subject: isSelected ? '' : subject }))
                      }
                    >
                      <Text
                        className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                        style={isSelected ? { color: accent.color, fontWeight: '700' } : undefined}
                      >
                        {subject}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Profesor
              </Text>
              <TextInput
                className="mb-4 rounded-[14px] border px-3.5 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark"
                style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                placeholder="Ej. Prof. Ramírez"
                placeholderTextColor={colors.icon}
                value={form.teacher}
                onChangeText={(teacher) => setForm((prev) => ({ ...prev, teacher }))}
              />

              <Text className="mb-2 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Días de clase
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {DAYS.map((day) => {
                  const isOn = form.days.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      className="h-11 w-11 items-center justify-center rounded-full border-[1.5px]"
                      style={{
                        borderColor: isOn ? Palette.primary : colors.cardBorder,
                        backgroundColor: isOn ? softTint(Palette.primary, isDark) : colors.background,
                      }}
                      activeOpacity={0.75}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isOn }}
                      accessibilityLabel={day}
                      onPress={() => toggleDay(day)}
                    >
                      <Text
                        className="text-[12px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                        style={isOn ? { color: Palette.primary } : undefined}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Hora
              </Text>
              <TouchableOpacity
                className="mb-5 flex-row items-center rounded-[14px] border px-3.5 py-3"
                style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Elegir la hora de clase"
                onPress={() => setTimeVisible(true)}
              >
                <Ionicons name="time-outline" size={17} color={colors.icon} />
                <Text
                  className="ml-2.5 flex-1 text-sm"
                  style={{ color: form.time ? colors.text : colors.icon }}
                >
                  {form.time ? formatTime12(form.time) : 'Sin hora'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.icon} />
              </TouchableOpacity>
            </ScrollView>

            <View className="mt-2 flex-row justify-end gap-2.5">
              <TouchableOpacity className="rounded-2xl px-4 py-3" onPress={closeForm}>
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-2xl px-6 py-3"
                style={{ backgroundColor: Palette.primary }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Guardar' : 'Crear salón'}
                onPress={handleSubmit}
              >
                <Text className="text-sm font-bold text-white">
                  {editingId ? 'Guardar' : 'Crear salón'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TimePickerSheet
        visible={isTimeVisible}
        title="Hora de clase"
        description="Desliza para elegir la hora"
        value={form.time || '08:00'}
        onCancel={() => setTimeVisible(false)}
        onSave={(time) => {
          setForm((prev) => ({ ...prev, time }));
          setTimeVisible(false);
        }}
      />
    </View>
  );
}
