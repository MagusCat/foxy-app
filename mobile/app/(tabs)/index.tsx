import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Switch,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { getSubjectAccent } from '@/constants/subject-colors';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

type Attachment = {
  id: string;
  kind: 'image' | 'file';
  name: string;
  uri: string;
};

/** Formatos de lección que Foxy podrá generar. */
const LESSON_TYPES: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'Cuestionario', icon: 'help-circle-outline', color: Palette.accentBlue },
  { label: 'Examen oral simulado', icon: 'mic-outline', color: Palette.accentPurple },
  { label: 'Verdadero o falso', icon: 'checkmark-circle-outline', color: '#10B981' },
  { label: 'Podcast', icon: 'headset-outline', color: '#EC4899' },
  { label: 'Tarjetas de memoria', icon: 'albums-outline', color: Palette.flameOrange },
  { label: 'Examen escrito simulado', icon: 'create-outline', color: '#14B8A6' },
];

const MOOD_OPTIONS: { emoji: string; label: string }[] = [
  { emoji: '😄', label: 'Genial' },
  { emoji: '🙂', label: 'Bien' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😕', label: 'Cansado' },
  { emoji: '😣', label: 'Estresado' },
];

const INITIAL_SUBJECTS = [
  'Matemáticas',
  'Física',
  'Química',
  'Informática',
  'Inglés',
  'Alemán',
  'Español',
  'Francés',
  'Biología',
  'Geografía',
  'Historia',
  'Economía',
  'Filosofía',
  'Psicología',
];

const isIOS = Platform.OS === 'ios';

// iOS usa objetivos táctiles ligeramente más grandes que Android.
const ACTION_CIRCLE = isIOS ? 'h-10 w-10' : 'h-9 w-9';
const CAMERA_PILL = isIOS ? 'h-10 w-12' : 'h-9 w-11';
const TALK_PILL = isIOS ? 'h-10' : 'h-9';
const ACTION_ICON_SIZE = isIOS ? 20 : 18;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  // Estados de la app (persistidos en el dispositivo)
  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [subjects, setSubjects] = usePersistentState<string[]>('foxy:subjects', INITIAL_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = usePersistentState(
    'foxy:selected-subject',
    'Matemáticas',
  );
  const [mood, setMood] = usePersistentState('foxy:mood', MOOD_OPTIONS[2]);
  const [streakCount] = useDailyStreak();

  const [inputMessage, setInputMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const subjectAccent = useMemo(() => getSubjectAccent(selectedSubject, isDark), [selectedSubject, isDark]);
  const canSend = inputMessage.trim().length > 0 || attachments.length > 0;

  // Estados de edición y modales
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubjectModalVisible, setSubjectModalVisible] = useState(false);
  const [subjectModalMode, setSubjectModalMode] = useState<'list' | 'add'>('list');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isMoodModalVisible, setMoodModalVisible] = useState(false);
  const [isStartModalVisible, setStartModalVisible] = useState(false);
  const [solverEnabled, setSolverEnabled] = useState(true);

  const addAttachments = (incoming: Omit<Attachment, 'id'>[]) => {
    if (incoming.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...incoming.map((item, index) => ({ ...item, id: `${Date.now()}-${prev.length + index}` })),
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  // Cámara nativa
  const handleCameraPress = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso denegado', 'Se requieren permisos de cámara para capturar fotos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (asset) {
        addAttachments([{ kind: 'image', uri: asset.uri, name: asset.fileName || 'Foto' }]);
      }
    } catch (error) {
      console.log('Error abriendo la cámara:', error);
      Alert.alert('No se pudo abrir la cámara', 'Inténtalo de nuevo.');
    }
  };

  // Selector de fotos de la galería (múltiple, igual que los archivos)
  const handlePhotosPress = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso denegado', 'Se requieren permisos para acceder a tus fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // allowsEditing es incompatible con la selección múltiple.
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });
      if (result.canceled) return;
      addAttachments(
        (result.assets ?? []).map((asset, index) => ({
          kind: 'image' as const,
          uri: asset.uri,
          name: asset.fileName || `Imagen ${index + 1}`,
        })),
      );
    } catch (error) {
      console.log('Error abriendo la galería:', error);
      Alert.alert('No se pudieron abrir tus fotos', 'Inténtalo de nuevo.');
    }
  };

  // Selector de archivos (múltiple)
  const handleFilesPress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });
      if (result.canceled) return;
      addAttachments(
        (result.assets ?? []).map((asset, index) => ({
          kind: 'file' as const,
          uri: asset.uri,
          name: asset.name || `Archivo ${index + 1}`,
        })),
      );
    } catch (error) {
      console.log('Error abriendo el selector de archivos:', error);
      Alert.alert('No se pudo abrir el archivo', 'Inténtalo de nuevo.');
    }
  };

  /**
   * Cierra el menú "Comenzar" y ejecuta la acción cuando ya terminó de
   * cerrarse. Hacer ambas cosas en el mismo tick falla de dos formas: al
   * navegar, el navegador congela la pantalla antes de aplicar el cierre y el
   * modal se queda abierto; y en iOS no se puede presentar nada nuevo (cámara,
   * Alert) mientras otro modal se está cerrando.
   */
  const closeStartModalThen = (action: () => void) => {
    setStartModalVisible(false);
    setTimeout(action, 260);
  };

  // Acciones del menú "Comenzar". Todo frontend: lo que necesita IA lo
  // decimos claramente, y lo que ya existe en la app navega de verdad.
  const handleScanProblem = () => closeStartModalThen(handleCameraPress);

  const handleLessonType = (label: string) =>
    closeStartModalThen(() =>
      Alert.alert(
        label,
        `Foxy generará "${label.toLowerCase()}" de ${selectedSubject} en cuanto conectemos la IA.`,
      ),
    );

  const goToTab = (path: '/(tabs)/exams' | '/(tabs)/class') =>
    closeStartModalThen(() => router.push(path));

  // Enviar: la IA todavía no está conectada, así que confirmamos lo que se
  // enviará en cuanto exista el backend en lugar de fingir una respuesta.
  const handleSend = () => {
    if (!canSend) return;
    const parts = [
      inputMessage.trim() ? 'tu pregunta' : null,
      attachments.length ? `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}` : null,
    ].filter(Boolean);

    Alert.alert(
      'Foxy todavía no está conectado',
      `Ya quedó listo ${parts.join(' y ')} sobre ${selectedSubject}. En cuanto conectemos la IA, Foxy responderá aquí mismo.`,
      [
        { text: 'Seguir editando', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: () => {
            setInputMessage('');
            setAttachments([]);
          },
        },
      ],
    );
  };

  const showComingSoon = (feature: string) => {
    Alert.alert('Próximamente', `${feature} estará disponible muy pronto.`);
  };

  // Agregar nueva materia
  const handleAddSubjectSubmit = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed) {
      Alert.alert('Campo vacío', 'Por favor ingresa un nombre para la nueva materia.');
      return;
    }
    if (subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Materia duplicada', 'Esta materia ya existe en tu lista.');
      return;
    }
    setSubjects((prev) => [...prev, trimmed]);
    setSelectedSubject(trimmed);
    setNewSubjectInput('');
    setSubjectModalMode('list');
  };

  // Eliminar materia (con confirmación)
  const handleDeleteSubject = (subjectToDelete: string) => {
    if (subjects.length <= 1) {
      Alert.alert('Atención', 'Debes conservar al menos una materia en tu lista.');
      return;
    }
    Alert.alert(
      'Eliminar materia',
      `¿Seguro que quieres eliminar "${subjectToDelete}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // Se calcula fuera del updater: mutar otro estado dentro de
            // setState provoca efectos duplicados en React 19.
            const updated = subjects.filter((s) => s !== subjectToDelete);
            setSubjects(updated);
            if (selectedSubject === subjectToDelete) {
              setSelectedSubject(updated[0] ?? 'Matemáticas');
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-5"
        contentContainerClassName="flex-grow"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom + 90,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* BARRA SUPERIOR (HEADER) */}
        <View className="flex-row items-center justify-between py-3">
          {/* Badge de Racha Destacado (Más Grande) */}
          <View className="flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3.5 py-[7px] dark:border-surface-dark-border dark:bg-surface-dark">
            <Ionicons name="flame" size={20} color={Palette.flameOrange} />
            <Text className="ml-1.5 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {streakCount}
            </Text>
          </View>

          {/* Avatar de Usuario */}
          <TouchableOpacity
            className="h-[38px] w-[38px] items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark"
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ir a mi perfil"
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              {userName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECCIÓN CENTRAL - BIENVENIDA
            flex-1 hace que absorba el espacio entre el header y el input, así
            el saludo queda centrado en la pantalla y no pegado arriba. */}
        <View className="flex-1 items-center justify-center py-8">
          <Text className="text-center text-[22px] font-bold tracking-[-0.3px] text-text-primary-light dark:text-text-primary-dark">
            ¡Hola {userName}, bienvenido! 👋
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Comenzar"
            onPress={() => setStartModalVisible(true)}
            className="mt-5 rounded-[22px]"
            style={{
              elevation: 8,
              shadowColor: Palette.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isDark ? 0.55 : 0.3,
              shadowRadius: 10,
            }}
          >
            <LinearGradient
              colors={[Palette.primary, Palette.accentBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 22,
              }}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text className="text-sm font-bold text-white" numberOfLines={1}>
                Comenzar
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* PANEL INFERIOR DE ENTRADA Y SELECCIÓN DE MATERIA */}
        <View className="mt-auto w-full items-center">
          {/* Selector de Materia */}
          <TouchableOpacity
            className="z-10 -mb-[13px] flex-row items-center rounded-[18px] border bg-white px-4 py-[7px] dark:bg-[#1B1522]"
            style={{ borderColor: subjectAccent.color, elevation: 4 }}
            activeOpacity={0.8}
            onPress={() => {
              setIsEditMode(false);
              setSubjectModalVisible(true);
            }}
          >
            <Text className="text-xs font-semibold" style={{ color: subjectAccent.color }}>
              {selectedSubject}
            </Text>
            <Ionicons name="swap-vertical" size={14} color={subjectAccent.color} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Panel Principal de Entrada */}
          <View
            className="w-full rounded-[22px] border bg-card-light px-3.5 pb-2.5 pt-5 dark:bg-card-dark"
            style={{ borderColor: subjectAccent.color }}
          >
            {/* Adjuntos listos para enviar */}
            {attachments.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2.5 -mx-1"
                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
              >
                {attachments.map((attachment) => (
                  <View
                    key={attachment.id}
                    className="flex-row items-center rounded-xl border border-card-light-border bg-surface-light py-1.5 pl-1.5 pr-1 dark:border-surface-dark-border dark:bg-surface-dark"
                  >
                    {attachment.kind === 'image' ? (
                      <Image
                        source={{ uri: attachment.uri }}
                        className="h-7 w-7 rounded-lg"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-7 w-7 items-center justify-center rounded-lg bg-card-light dark:bg-card-dark">
                        <Ionicons name="document-text-outline" size={15} color="#FBBF24" />
                      </View>
                    )}

                    <Text
                      className="mx-1.5 max-w-[120px] text-[11px] font-medium text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={1}
                    >
                      {attachment.name}
                    </Text>

                    <TouchableOpacity
                      className="h-6 w-6 items-center justify-center rounded-full"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${attachment.name}`}
                      onPress={() => removeAttachment(attachment.id)}
                    >
                      <Ionicons name="close" size={14} color={iconOnSurface} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TextInput
              className="mb-2.5 text-sm text-text-primary-light dark:text-text-primary-dark"
              style={{ minHeight: 38, textAlignVertical: 'top' }}
              placeholder="Pregunta, habla o envía un archivo"
              placeholderTextColor={isDark ? Palette.textSecondaryDark : Palette.textMutedLight}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
            />

            {/* Barra de Acciones */}
            <View className="flex-row items-center justify-between pt-0.5">
              {/* Izquierda: Agregar (+) y Cámara */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className={`${ACTION_CIRCLE} items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark`}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Más opciones"
                  onPress={() => setOptionsModalVisible(true)}
                >
                  <Ionicons name="add" size={ACTION_ICON_SIZE} color={iconOnSurface} />
                </TouchableOpacity>

                <TouchableOpacity
                  className={`${CAMERA_PILL} items-center justify-center rounded-full`}
                  style={{ backgroundColor: subjectAccent.color }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir cámara"
                  onPress={handleCameraPress}
                >
                  <Ionicons name="camera" size={ACTION_ICON_SIZE} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Derecha: Micrófono y Hablar */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className={`${ACTION_CIRCLE} items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark`}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dictar por voz"
                  onPress={() => showComingSoon('El micrófono')}
                >
                  <Ionicons name="mic-outline" size={ACTION_ICON_SIZE} color={iconOnSurface} />
                </TouchableOpacity>

                {/* Con contenido escrito o adjunto, "Hablar" cede su lugar a Enviar. */}
                {canSend ? (
                  <TouchableOpacity
                    className={`${CAMERA_PILL} items-center justify-center rounded-full`}
                    style={{ backgroundColor: subjectAccent.color }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar a Foxy"
                    onPress={handleSend}
                  >
                    <Ionicons name="arrow-up" size={ACTION_ICON_SIZE} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className={`${TALK_PILL} flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3 dark:border-surface-dark-border dark:bg-surface-dark`}
                    activeOpacity={0.8}
                    onPress={() => showComingSoon('El modo de voz')}
                  >
                    <Text className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                      Hablar
                    </Text>
                    <Ionicons name="stats-chart" size={12} color={iconOnSurface} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ========================================== */}
      {/* MODAL 1: ELIGE LA MATERIA                  */}
      {/* ========================================== */}
      <Modal
        visible={isSubjectModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => {
          setIsEditMode(false);
          setSubjectModalMode('list');
          setSubjectModalVisible(false);
        }}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => {
              setIsEditMode(false);
              setSubjectModalMode('list');
              setSubjectModalVisible(false);
            }}
          />
          <View
            className="max-h-[85%] flex-col rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            {subjectModalMode === 'list' ? (
              <>
                {/* Header del Modal (altura fija) */}
                <View className="mb-3.5 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    {isEditMode ? 'Gestionar materias' : 'Elige la materia'}
                  </Text>
                  <TouchableOpacity
                    className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={() => {
                      setIsEditMode(false);
                      setSubjectModalVisible(false);
                    }}
                  >
                    <Ionicons name="close" size={18} color={iconOnSurface} />
                  </TouchableOpacity>
                </View>

                {/* Lista de materias. OJO: aquí va flexShrink, NO flex-1.
                    El contenedor solo tiene maxHeight (altura automática), y en
                    iOS un hijo con flex:1 dentro de un padre sin altura definida
                    colapsa a 0 y la lista desaparece. Con flexShrink la lista
                    crece con su contenido y solo se encoge si no cabe, dejando
                    el footer (Editar / Agregar) siempre visible. */}
                <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                  <View className="flex-row flex-wrap justify-between py-0.5">
                    {subjects.map((subject) => {
                      const isSelected = selectedSubject === subject;
                      const cardColor =
                        isSelected && !isEditMode
                          ? 'border-[1.5px] border-primary bg-[#FEE2E2] dark:border-primary-glow dark:bg-[#2D1B22]'
                          : isEditMode
                            ? 'border-[#D1D5DB] bg-[#F9FAFB] dark:border-[#3D364A] dark:bg-[#1C1924]'
                            : 'border-[#E5E7EB] bg-white dark:border-[#2D2838] dark:bg-[#1F1C28]';
                      const textColor =
                        isSelected && !isEditMode
                          ? 'font-bold text-text-primary-light dark:text-text-primary-dark'
                          : 'text-text-secondary-light dark:text-[#D1D5DB]';
                      return (
                        <TouchableOpacity
                          key={subject}
                          className={`mb-2.5 w-[48%] flex-row items-center justify-between rounded-[14px] border px-3 py-2.5 ${cardColor}`}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isEditMode) {
                              setSelectedSubject(subject);
                              setSubjectModalVisible(false);
                            }
                          }}
                        >
                          <Text
                            className={`flex-1 text-xs font-medium ${textColor}`}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {subject}
                          </Text>

                          {/* Modo Edición: Muestra botón de eliminar */}
                          {isEditMode ? (
                            <TouchableOpacity
                              // Área táctil mayor sin agrandar el ícono.
                              className="ml-1 p-0.5"
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Eliminar ${subject}`}
                              onPress={() => handleDeleteSubject(subject)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          ) : (
                            isSelected && (
                              <Ionicons
                                name="checkmark"
                                size={15}
                                color={subjectAccent.color}
                                style={{ marginLeft: 4 }}
                              />
                            )
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Acciones inferiores del modal (altura fija, siempre visibles) */}
                <View className="mt-3.5 flex-row items-center justify-end gap-2.5 pt-1.5">
                  <TouchableOpacity
                    className={`flex-row items-center rounded-[18px] border px-4 py-2 ${
                      isEditMode
                        ? 'border-primary bg-[#FEE2E2] dark:border-primary-glow dark:bg-[#2D1B22]'
                        : 'border-[#E5E7EB] bg-white dark:border-[#342F42] dark:bg-[#1F1C28]'
                    }`}
                    activeOpacity={0.8}
                    onPress={() => setIsEditMode(!isEditMode)}
                  >
                    <Ionicons
                      name={isEditMode ? 'checkmark-circle-outline' : 'pencil-outline'}
                      size={15}
                      color={iconOnSurface}
                      style={{ marginRight: 4 }}
                    />
                    <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {isEditMode ? 'Listo' : 'Editar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center rounded-[18px] bg-primary px-[18px] py-2"
                    activeOpacity={0.8}
                    onPress={() => setSubjectModalMode('add')}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
                    <Text className="text-[13px] font-semibold text-white">Agregar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Header del sub-formulario: Agregar Materia (misma modal, sin apilar) */}
                <View className="mb-3.5 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    Nueva Materia
                  </Text>
                  <TouchableOpacity
                    className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={() => {
                      setNewSubjectInput('');
                      setSubjectModalMode('list');
                    }}
                  >
                    <Ionicons name="close" size={18} color={iconOnSurface} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  className="mb-[18px] rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                  placeholder="Ej. Robótica, Filosofía..."
                  placeholderTextColor="#6B7280"
                  value={newSubjectInput}
                  onChangeText={setNewSubjectInput}
                  autoFocus
                />
                <View className="flex-row justify-end gap-2.5">
                  <TouchableOpacity
                    className="rounded-2xl px-4 py-2"
                    onPress={() => {
                      setNewSubjectInput('');
                      setSubjectModalMode('list');
                    }}
                  >
                    <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="rounded-2xl bg-primary px-5 py-2"
                    onPress={handleAddSubjectSubmit}
                  >
                    <Text className="text-sm font-semibold text-white">Guardar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 2: OPCIONES DE AGREGAR (+)           */}
      {/* ========================================== */}
      <Modal
        visible={isOptionsModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setOptionsModalVisible(false)}
          />
          <View
            className="rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            {/* Header del Modal */}
            <View className="relative mb-3.5 items-center justify-center">
              <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Opciones
              </Text>
              <TouchableOpacity
                className="absolute -top-1 right-0 h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                onPress={() => setOptionsModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
              </TouchableOpacity>
            </View>

            {/* Acceso Rápido */}
            <View className="my-1.5 flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  handleCameraPress();
                }}
              >
                <Ionicons name="camera-outline" size={22} color={Palette.accentBlueGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Cámara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  handlePhotosPress();
                }}
              >
                <Ionicons name="images-outline" size={22} color={Palette.primaryGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Fotos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  handleFilesPress();
                }}
              >
                <Ionicons name="folder-outline" size={22} color="#FBBF24" />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Archivos
                </Text>
              </TouchableOpacity>
            </View>

            <View className="my-3 h-px bg-[#E5E7EB] dark:bg-[#2A2533]" />

            {/* Opciones Avanzadas */}
            <View className="gap-3.5">
              <TouchableOpacity
                className="flex-row items-center py-1"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  showComingSoon('El lienzo para dibujar');
                }}
              >
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="color-palette-outline" size={20} color={iconOnSurface} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Dibujar
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Dibuja tus ideas
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-1"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  showComingSoon('El teclado matemático');
                }}
              >
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="calculator-outline" size={20} color={iconOnSurface} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Teclado matemático
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Ingresa símbolos y ecuaciones
                  </Text>
                </View>
              </TouchableOpacity>

              <View className="flex-row items-center py-1">
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="flash-outline" size={20} color="#FBBF24" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Solucionador
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Obtén soluciones completas rápidamente
                  </Text>
                </View>
                <Switch
                  value={solverEnabled}
                  onValueChange={setSolverEnabled}
                  trackColor={{
                    false: isDark ? '#2D2D3A' : '#D1D5DB',
                    true: Palette.primary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                className="flex-row items-center py-1"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  setMoodModalVisible(true);
                }}
              >
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="happy-outline" size={20} color={iconOnSurface} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Estado de ánimo de hoy
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    {mood.emoji} {mood.label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 3: ESTADO DE ÁNIMO DE HOY            */}
      {/* ========================================== */}
      <Modal
        visible={isMoodModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => setMoodModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-6 dark:bg-black/80">
          <View
            className="w-full rounded-[22px] border border-[#E5E7EB] bg-white p-5 dark:border-[#342F42] dark:bg-[#1C1924]"
            style={{ elevation: 10 }}
          >
            <Text className="mb-3.5 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              ¿Cómo te sientes hoy?
            </Text>
            <View className="flex-row flex-wrap justify-between gap-2.5">
              {MOOD_OPTIONS.map((option) => {
                const isSelected = mood.label === option.label;
                return (
                  <TouchableOpacity
                    key={option.label}
                    className="w-[30%] items-center justify-center rounded-2xl border-[1.5px] border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    style={isSelected ? { borderColor: subjectAccent.color, backgroundColor: subjectAccent.soft } : undefined}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMood(option);
                      setMoodModalVisible(false);
                    }}
                  >
                    <Text className="mb-1 text-2xl">{option.emoji}</Text>
                    <Text className="text-[11px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 4: COMENZAR                          */}
      {/* ========================================== */}
      <Modal
        visible={isStartModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setStartModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setStartModalVisible(false)}
          />
          <View
            className="max-h-[88%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                ¿Qué quieres hacer?
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setStartModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {/* ESCANEAR PROBLEMA */}
              <TouchableOpacity
                className="mb-4 flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Escanear problema"
                onPress={handleScanProblem}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#152238' : '#DBEAFE' }}
                >
                  <Ionicons name="scan-outline" size={24} color={Palette.accentBlue} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    Escanear problema
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Toma una foto y obtén ayuda paso a paso
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              {/* CREAR UNA LECCIÓN */}
              <Text className="mb-2.5 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                Crear una lección
              </Text>
              <View className="mb-4 flex-row flex-wrap justify-between">
                {LESSON_TYPES.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.label}
                    className="mb-2.5 w-[48%] items-start rounded-[16px] border border-[#E5E7EB] bg-white p-3 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={lesson.label}
                    onPress={() => handleLessonType(lesson.label)}
                  >
                    <Ionicons name={lesson.icon} size={20} color={lesson.color} />
                    <Text
                      className="mt-2 text-xs font-semibold leading-[16px] text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={2}
                    >
                      {lesson.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* PLAN DE ESTUDIO */}
              <TouchableOpacity
                className="mb-3 flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Planes de estudio para tu examen"
                onPress={() => goToTab('/(tabs)/exams')}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#2D1B22' : '#FEE2E2' }}
                >
                  <Ionicons name="calendar-outline" size={22} color={Palette.primary} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    ¿Se acerca un examen?
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Aprende con planes de estudio creados por inteligencia artificial
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              {/* CLASE / COMPAÑEROS */}
              <TouchableOpacity
                className="flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Conéctate con tus compañeros"
                onPress={() => goToTab('/(tabs)/class')}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#241A33' : '#F3E8FF' }}
                >
                  <Ionicons name="people-outline" size={22} color={Palette.accentPurple} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    Conéctate con tus compañeros
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Crea o únete a una clase
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
