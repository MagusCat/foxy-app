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
import { useRouter } from 'expo-router';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { getSubjectAccent } from '@/constants/subject-colors';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

const EXAM_SUBJECTS = [
  'Matemáticas',
  'Física',
  'Química',
  'Biología',
  'Historia',
  'Inglés',
];

type RecentExam = {
  id: string;
  subject: string;
  /** ISO: se guarda en disco como JSON, donde Date no sobrevive. */
  createdAt: string;
};

export default function ExamsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  const [streakCount] = useDailyStreak();
  const [userName] = usePersistentState('foxy:user-name', 'Usuario');

  const [school, setSchool] = usePersistentState('foxy:school', '');
  const [schoolInput, setSchoolInput] = useState('');
  const [isSchoolModalVisible, setSchoolModalVisible] = useState(false);

  const [recentExams, setRecentExams] = usePersistentState<RecentExam[]>('foxy:recent-exams', []);
  const [isCreateExamModalVisible, setCreateExamModalVisible] = useState(false);
  const [examSubject, setExamSubject] = useState(EXAM_SUBJECTS[0]);

  const sheetPaddingBottom = useSheetPaddingBottom();

  const handleCreateExam = () => {
    const newExam: RecentExam = {
      id: `${Date.now()}`,
      subject: examSubject,
      createdAt: new Date().toISOString(),
    };
    setRecentExams([newExam, ...recentExams]);
    setCreateExamModalVisible(false);
    Alert.alert('Examen creado', `Tu examen de ${examSubject} está listo para practicar.`);
  };

  const handleDeleteExam = (exam: RecentExam) => {
    Alert.alert('Eliminar examen', `¿Eliminar tu examen de ${exam.subject}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => setRecentExams(recentExams.filter((item) => item.id !== exam.id)),
      },
    ]);
  };

  const handleSaveSchool = () => {
    const trimmed = schoolInput.trim();
    if (!trimmed) {
      Alert.alert('Campo vacío', 'Por favor ingresa el nombre de tu escuela.');
      return;
    }
    setSchool(trimmed);
    setSchoolInput('');
    setSchoolModalVisible(false);
  };

  const showComingSoon = (feature: string) => {
    Alert.alert('Próximamente', `${feature} estará disponible muy pronto.`);
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
        {/* BARRA SUPERIOR (HEADER) */}
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3.5 py-[7px] dark:border-surface-dark-border dark:bg-surface-dark">
            <Ionicons name="flame" size={20} color={Palette.flameOrange} />
            <Text className="ml-1.5 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {streakCount}
            </Text>
          </View>

          <TouchableOpacity
            className="h-[38px] w-[38px] items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark"
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              {userName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* HERO: PREPÁRATE PARA TUS EXÁMENES */}
        <View className="mt-2 items-start rounded-[24px] border border-card-light-border bg-card-light p-5 dark:border-card-dark-border dark:bg-card-dark">
          <View className="mb-3.5 flex-row">
            <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-card-light bg-[#FEE2E2] dark:border-card-dark dark:bg-[#2D1B22]">
              <Ionicons name="flame" size={18} color={Palette.primary} />
            </View>
            <View className="-ml-2.5 h-10 w-10 items-center justify-center rounded-full border-2 border-card-light bg-[#DBEAFE] dark:border-card-dark dark:bg-[#152238]">
              <Ionicons name="school" size={18} color={Palette.accentBlue} />
            </View>
          </View>

          <Text className="mb-1.5 text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Prepárate para tus exámenes con IA
          </Text>
          <Text className="mb-[18px] text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
            Foxy genera exámenes de práctica a tu medida según lo que necesitas repasar.
          </Text>

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
            onPress={() => setCreateExamModalVisible(true)}
          >
            <LinearGradient
              colors={[Palette.primary, Palette.accentBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 20,
              }}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text className="text-sm font-bold text-white">Crear mi examen</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                '¿Cómo funciona?',
                'Elige una materia y Foxy arma un examen de práctica con preguntas adaptadas a tu nivel.',
              )
            }
          >
            <Text className="mt-3 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
              ¿Cómo funciona? <Ionicons name="information-circle-outline" size={13} />
            </Text>
          </TouchableOpacity>
        </View>

        {/* EXÁMENES RECIENTES (si el usuario ya creó alguno) */}
        {recentExams.length > 0 && (
          <View className="mt-[26px]">
            <Text className="mb-3 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Tus exámenes
            </Text>
            {recentExams.map((exam) => {
              const accent = getSubjectAccent(exam.subject, isDark);
              return (
                <TouchableOpacity
                  key={exam.id}
                  activeOpacity={0.7}
                  className="mb-2.5 flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
                  onPress={() => showComingSoon('La práctica de este examen')}
                >
                  <View className="mr-3 h-2 w-2 rounded-full" style={{ backgroundColor: accent.color }} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {exam.subject}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      Creado {new Date(exam.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="mr-1 h-8 w-8 items-center justify-center rounded-full"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar examen de ${exam.subject}`}
                    onPress={() => handleDeleteExam(exam)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* MI ESCUELA */}
        <View className="mt-[26px]">
          <Text className="mb-3 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            Mi escuela
          </Text>

          {school ? (
            <TouchableOpacity
              className="flex-row items-center rounded-[18px] border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
              activeOpacity={0.8}
              onPress={() => {
                setSchoolInput(school);
                setSchoolModalVisible(true);
              }}
            >
              <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-2xl bg-[#DBEAFE] dark:bg-[#152238]">
                <Ionicons name="school-outline" size={18} color={Palette.accentBlue} />
              </View>
              <Text className="flex-1 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark" numberOfLines={1}>
                {school}
              </Text>
              <Ionicons name="pencil-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          ) : (
            <View className="rounded-[20px] border border-card-light-border bg-card-light p-[18px] dark:border-card-dark-border dark:bg-card-dark">
              <Text className="mb-1.5 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                ¿A qué escuela vas?
              </Text>
              <Text className="mb-3.5 text-xs leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                Personaliza tus exámenes con contenido relacionado a tus profesores y clases.
              </Text>
              <TouchableOpacity
                className="flex-row items-center self-start rounded-2xl bg-primary px-4 py-[9px]"
                activeOpacity={0.8}
                onPress={() => setSchoolModalVisible(true)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text className="text-[13px] font-semibold text-white">Agregar escuela</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* MÁS PREPARACIONES DE EXAMEN */}
        <View className="mt-[26px] mb-6">
          <Text className="mb-3 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            Más preparaciones de examen
          </Text>

          <View className="items-start rounded-[20px] border border-card-light-border bg-card-light p-[18px] dark:border-card-dark-border dark:bg-card-dark">
            <View className="mb-2.5 h-10 w-10 items-center justify-center rounded-full bg-accent-purple">
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            </View>
            <Text className="mb-1 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Preparado por Foxy AI
            </Text>
            <Text className="mb-3.5 text-xs leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
              Practica con preguntas generadas por Foxy, tu asistente de estudio con IA.
            </Text>
            <TouchableOpacity
              className="flex-row items-center rounded-2xl border-[1.5px] border-primary px-4 py-2 dark:border-primary-glow"
              activeOpacity={0.8}
              onPress={() => showComingSoon('El explorador de preparaciones')}
            >
              <Text className="text-[13px] font-bold text-primary dark:text-primary-glow">Explorar</Text>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={isDark ? Palette.primaryGlow : Palette.primary}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* MODAL: CREAR MI EXAMEN */}
      <Modal
        visible={isCreateExamModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setCreateExamModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setCreateExamModalVisible(false)}
          />
          <View
            className="max-h-[85%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Crear mi examen
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                onPress={() => setCreateExamModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
              </TouchableOpacity>
            </View>

            <Text className="mb-3 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              Elige la materia para tu examen de práctica:
            </Text>

            <View className="mb-5 flex-row flex-wrap gap-2">
              {EXAM_SUBJECTS.map((subject) => {
                const isSelected = examSubject === subject;
                const accent = getSubjectAccent(subject, isDark);
                return (
                  <TouchableOpacity
                    key={subject}
                    className="rounded-2xl border-[1.5px] border-[#E5E7EB] bg-white px-3.5 py-[9px] dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    style={isSelected ? { borderColor: accent.color, backgroundColor: accent.soft } : undefined}
                    activeOpacity={0.7}
                    onPress={() => setExamSubject(subject)}
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

            <TouchableOpacity
              className="items-center rounded-[18px] bg-primary py-3.5"
              activeOpacity={0.85}
              onPress={handleCreateExam}
            >
              <Text className="text-sm font-bold text-white">Generar examen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: AGREGAR / EDITAR ESCUELA */}
      <Modal
        visible={isSchoolModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => setSchoolModalVisible(false)}
      >
        <View
          className="flex-1 items-center justify-center bg-black/55 px-6 dark:bg-black/80"
          // El diálogo está centrado y el input abre el teclado con autoFocus:
          // sin este padding el teclado tapa el campo y el botón Guardar.
          style={{ paddingBottom: keyboardHeight }}
        >
          <View
            className="w-full rounded-[22px] border border-[#E5E7EB] bg-white p-5 dark:border-[#342F42] dark:bg-[#1C1924]"
            style={{ elevation: 10 }}
          >
            <Text className="mb-3.5 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              {school ? 'Editar escuela' : 'Agregar escuela'}
            </Text>
            <TextInput
              className="mb-[18px] rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
              placeholder="Ej. Colegio San José"
              placeholderTextColor="#6B7280"
              value={schoolInput}
              onChangeText={setSchoolInput}
              autoFocus
            />
            <View className="flex-row justify-end gap-2.5">
              <TouchableOpacity
                className="rounded-2xl px-4 py-2"
                onPress={() => {
                  setSchoolInput('');
                  setSchoolModalVisible(false);
                }}
              >
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity className="rounded-2xl bg-primary px-5 py-2" onPress={handleSaveSchool}>
                <Text className="text-sm font-semibold text-white">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
