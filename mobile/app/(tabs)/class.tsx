import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { getSubjectAccent } from '@/constants/subject-colors';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  teacher: string;
  schedule: string;
  code: string;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I/O/0/1 para evitar confusiones

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const EMPTY_FORM = { name: '', subject: '', teacher: '', schedule: '' };

export default function ClassScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  const [rooms, setRooms] = usePersistentState<Classroom[]>('foxy:classrooms', []);

  const [isFormVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
      schedule: room.schedule,
    });
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

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
      schedule: form.schedule.trim(),
    };

    if (editingId) {
      setRooms(rooms.map((room) => (room.id === editingId ? { ...room, ...details } : room)));
    } else {
      setRooms([
        { id: `${Date.now()}`, code: generateRoomCode(), ...details },
        ...rooms,
      ]);
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
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between py-3">
          <View>
            <Text className="text-[26px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Clase
            </Text>
            <Text className="mt-1 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              {rooms.length > 0
                ? `${rooms.length} ${rooms.length === 1 ? 'salón' : 'salones'}`
                : 'Organiza tus materias en salones'}
            </Text>
          </View>

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
            <LinearGradient
              colors={[Palette.primary, Palette.accentBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
              }}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text className="text-[13px] font-bold text-white">Crear salón</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {rooms.length === 0 ? (
          /* ESTADO VACÍO */
          <View className="mt-6 items-center rounded-[24px] border border-card-light-border bg-card-light px-6 py-10 dark:border-card-dark-border dark:bg-card-dark">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2] dark:bg-[#2D1B22]">
              <Text className="text-3xl">🦊</Text>
            </View>
            <Text className="mb-2 text-center text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              Aún no tienes salones
            </Text>
            <Text className="mb-5 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
              Crea un salón para agrupar tus apuntes, materiales y exámenes por materia. Foxy los
              usará para darte ayuda más precisa.
            </Text>
            <TouchableOpacity
              className="flex-row items-center rounded-2xl bg-primary px-5 py-3"
              activeOpacity={0.85}
              onPress={openCreateForm}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text className="text-[13px] font-semibold text-white">Crear mi primer salón</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* LISTA DE SALONES */
          <View className="mt-2">
            {rooms.map((room) => {
              const accent = getSubjectAccent(room.subject || room.name, isDark);
              const meta = [room.subject, room.teacher].filter(Boolean).join(' · ');

              return (
                <View
                  key={room.id}
                  className="mb-3 overflow-hidden rounded-[20px] border border-card-light-border bg-card-light dark:border-card-dark-border dark:bg-card-dark"
                >
                  {/* Franja de color por materia */}
                  <View style={{ height: 4, backgroundColor: accent.color }} />

                  <View className="p-4">
                    <View className="flex-row items-start justify-between">
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
                          <Ionicons name="pencil-outline" size={17} color={iconOnSurface} />
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

                    <View className="mt-3 flex-row items-center justify-between">
                      {room.schedule ? (
                        <View className="flex-row items-center">
                          <Ionicons name="time-outline" size={13} color="#6B7280" />
                          <Text className="ml-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {room.schedule}
                          </Text>
                        </View>
                      ) : (
                        <View />
                      )}

                      {/* Código pensado para unirse al salón cuando exista backend */}
                      <TouchableOpacity
                        className="flex-row items-center rounded-full px-2.5 py-1"
                        style={{ backgroundColor: accent.soft }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Código del salón ${room.code}`}
                        onPress={() =>
                          Alert.alert(
                            'Código del salón',
                            `${room.code}\n\nCuando conectemos la app, tus compañeros podrán unirse a "${room.name}" con este código.`,
                          )
                        }
                      >
                        <Ionicons name="key-outline" size={12} color={accent.color} />
                        <Text
                          className="ml-1 text-[11px] font-bold"
                          style={{ color: accent.color }}
                        >
                          {room.code}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL: CREAR / EDITAR SALÓN */}
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
            className="max-h-[85%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {editingId ? 'Editar salón' : 'Nuevo salón'}
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={closeForm}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
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
                className="mb-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="Ej. Matemáticas 3ºB"
                placeholderTextColor="#6B7280"
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                autoFocus
              />

              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Materia
              </Text>
              <TextInput
                className="mb-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="Ej. Matemáticas"
                placeholderTextColor="#6B7280"
                value={form.subject}
                onChangeText={(subject) => setForm((prev) => ({ ...prev, subject }))}
              />

              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Profesor
              </Text>
              <TextInput
                className="mb-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="Ej. Prof. Ramírez"
                placeholderTextColor="#6B7280"
                value={form.teacher}
                onChangeText={(teacher) => setForm((prev) => ({ ...prev, teacher }))}
              />

              <Text className="mb-1.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Horario
              </Text>
              <TextInput
                className="mb-5 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="Ej. Lun y Mié 10:00"
                placeholderTextColor="#6B7280"
                value={form.schedule}
                onChangeText={(schedule) => setForm((prev) => ({ ...prev, schedule }))}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </ScrollView>

            <View className="mt-2 flex-row justify-end gap-2.5">
              <TouchableOpacity className="rounded-2xl px-4 py-3" onPress={closeForm}>
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-2xl bg-primary px-6 py-3"
                activeOpacity={0.85}
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
    </View>
  );
}
