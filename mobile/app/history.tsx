import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Card, Note, ScreenShell, softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { useTheme } from '@/contexts/theme-context';
import {
  ANSWER_MODES,
  usePendingQuestion,
  useQuestionHistory,
  type AskedQuestion,
} from '@/hooks/use-question-history';

type Filter = 'todas' | 'guardadas';

/** "Hace 5 min" / "Ayer" / "12 de marzo" */
function describeMoment(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;

  return date.toLocaleDateString();
}

function attachmentSummary(question: AskedQuestion) {
  const parts: string[] = [];
  if (question.images > 0) parts.push(`${question.images} ${question.images === 1 ? 'foto' : 'fotos'}`);
  if (question.files > 0) parts.push(`${question.files} ${question.files === 1 ? 'archivo' : 'archivos'}`);
  return parts.join(' · ');
}

export default function HistoryScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { questions, saved, toggleSaved, removeQuestion, clearUnsaved } = useQuestionHistory();
  const [, setPending] = usePendingQuestion();

  const [filter, setFilter] = useState<Filter>('todas');
  const list = filter === 'guardadas' ? saved : questions;

  const handleAskAgain = (question: AskedQuestion) => {
    // La pregunta viaja por estado compartido y se vuelve cerrando la pila, no
    // navegando con parámetros: eso apilaba una segunda pantalla de Preguntar
    // y el botón atrás llevaba a un inicio duplicado.
    setPending({ text: question.text, subject: question.subject });

    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  const handleDelete = (question: AskedQuestion) => {
    Alert.alert('Eliminar pregunta', '¿Quitarla de tu historial?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeQuestion(question.id) },
    ]);
  };

  const handleClear = () => {
    Alert.alert(
      'Limpiar historial',
      'Se borrarán las preguntas que no tengas guardadas. Las guardadas se quedan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: clearUnsaved },
      ],
    );
  };

  return (
    <ScreenShell title="Mis preguntas" subtitle="Todo lo que le has preguntado a Foxy">
      {/* FILTROS */}
      <View className="mt-2 flex-row rounded-full p-1" style={{ backgroundColor: colors.surface }}>
        {([
          { value: 'todas' as const, label: `Todas (${questions.length})` },
          { value: 'guardadas' as const, label: `Guardadas (${saved.length})` },
        ]).map((option) => {
          const isSelected = filter === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              className="flex-1 items-center rounded-full py-2"
              style={{ backgroundColor: isSelected ? colors.card : 'transparent' }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setFilter(option.value)}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: isSelected ? colors.text : colors.textSecondary }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {list.length === 0 ? (
        <Card className="mt-4">
          <View className="items-center px-5 py-10">
            <Ionicons
              name={filter === 'guardadas' ? 'bookmark-outline' : 'chatbubbles-outline'}
              size={30}
              color={colors.icon}
            />
            <Text className="mt-3 text-center text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {filter === 'guardadas' ? 'Todavía no guardas ninguna' : 'Aún no has preguntado nada'}
            </Text>
            <Text className="mt-1.5 text-center text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
              {filter === 'guardadas'
                ? 'Toca el marcador de una pregunta para tenerla siempre a mano.'
                : 'Escríbele a Foxy desde la pestaña Preguntar y aquí quedará tu historial.'}
            </Text>
          </View>
        </Card>
      ) : (
        <View className="mt-4 gap-2.5">
          {list.map((question) => {
            const accent = getSubjectAccent(question.subject, isDark);
            const mode = ANSWER_MODES.find((item) => item.value === question.mode);
            const attachments = attachmentSummary(question);

            return (
              <Card key={question.id}>
                {/* El texto es el pulsable y la fila de acciones va aparte:
                    anidar botones deja ambiguo cuál responde al toque. */}
                <View className="p-3.5">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Volver a preguntar: ${question.text}`}
                    onPress={() => handleAskAgain(question)}
                  >
                    <View className="mb-2 flex-row items-center">
                      <View
                        className="rounded-full px-2.5 py-1"
                        style={{ backgroundColor: softTint(accent.color, isDark) }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: accent.color }}>
                          {question.subject}
                        </Text>
                      </View>

                      <Text className="ml-auto text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {describeMoment(question.at)}
                      </Text>
                    </View>

                    <Text
                      className="text-[14px] leading-[20px] text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={3}
                    >
                      {question.text || 'Pregunta con adjuntos'}
                    </Text>
                  </TouchableOpacity>

                  <View className="mt-2.5 flex-row items-center">
                    {mode ? (
                      <View className="flex-row items-center">
                        <Ionicons name={mode.icon} size={12} color={colors.icon} />
                        <Text className="ml-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                          {mode.label}
                        </Text>
                      </View>
                    ) : null}

                    {attachments ? (
                      <View className="ml-3 flex-row items-center">
                        <Ionicons name="attach-outline" size={12} color={colors.icon} />
                        <Text className="ml-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                          {attachments}
                        </Text>
                      </View>
                    ) : null}

                    <View className="ml-auto flex-row items-center gap-1">
                      <TouchableOpacity
                        className="h-8 w-8 items-center justify-center rounded-full"
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={question.saved ? 'Quitar de guardadas' : 'Guardar pregunta'}
                        onPress={() => toggleSaved(question.id)}
                      >
                        <Ionicons
                          name={question.saved ? 'bookmark' : 'bookmark-outline'}
                          size={16}
                          color={question.saved ? accent.color : colors.icon}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="h-8 w-8 items-center justify-center rounded-full"
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar pregunta"
                        onPress={() => handleDelete(question)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {questions.length > saved.length ? (
        <TouchableOpacity
          className="mt-4 flex-row items-center justify-center rounded-2xl border py-3"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Limpiar historial"
          onPress={handleClear}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
          <Text className="text-[13px] font-semibold" style={{ color: '#EF4444' }}>
            Limpiar historial
          </Text>
        </TouchableOpacity>
      ) : null}

      <Note icon="bulb-outline">
        Toca cualquier pregunta para volver a enviarla. Las guardadas se quedan aunque limpies el
        historial.
      </Note>
    </ScreenShell>
  );
}
