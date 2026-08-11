import React, { useState } from 'react';
import { Alert } from 'react-native';

import {
  Card,
  CardDivider,
  Note,
  PromptModal,
  Row,
  ScreenShell,
  SectionTitle,
  SwitchRow,
} from '@/components/settings-ui';
import { usePersistentState } from '@/hooks/use-persistent-state';

type NotificationPrefs = {
  enabled: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  streakAlert: boolean;
  examReminder: boolean;
  newLessons: boolean;
  weeklyReport: boolean;
  quietHours: boolean;
  quietFrom: string;
  quietTo: string;
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  dailyReminder: true,
  reminderTime: '18:00',
  streakAlert: true,
  examReminder: true,
  newLessons: false,
  weeklyReport: true,
  quietHours: true,
  quietFrom: '21:30',
  quietTo: '07:00',
};

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

type TimeField = 'reminderTime' | 'quietFrom' | 'quietTo' | null;

const TIME_LABELS: Record<Exclude<TimeField, null>, string> = {
  reminderTime: 'Hora del recordatorio',
  quietFrom: 'No molestar desde',
  quietTo: 'No molestar hasta',
};

export default function NotificationsScreen() {
  const [prefs, setPrefs] = usePersistentState<NotificationPrefs>('foxy:notifications', DEFAULT_PREFS);
  const [editing, setEditing] = useState<TimeField>(null);

  const update = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  const handleSaveTime = (value: string) => {
    if (!TIME_PATTERN.test(value)) {
      Alert.alert('Hora no válida', 'Usa el formato de 24 horas, por ejemplo 08:30 o 19:45.');
      return;
    }
    if (editing) update(editing, value);
    setEditing(null);
  };

  const off = !prefs.enabled;

  return (
    <ScreenShell title="Notificaciones" subtitle="Cuándo y para qué te avisa Foxy">
      <SectionTitle>General</SectionTitle>
      <Card>
        <SwitchRow
          icon="notifications-outline"
          label="Permitir notificaciones"
          description="Si lo apagas, Foxy no te enviará ningún aviso"
          value={prefs.enabled}
          onValueChange={(value) => update('enabled', value)}
        />
      </Card>

      <SectionTitle>Estudio</SectionTitle>
      <Card>
        <SwitchRow
          icon="alarm-outline"
          label="Recordatorio diario"
          description="Un aviso amable para sentarte a estudiar"
          value={prefs.dailyReminder}
          onValueChange={(value) => update('dailyReminder', value)}
          disabled={off}
        />
        <CardDivider />
        <Row
          icon="time-outline"
          label="Hora del recordatorio"
          value={prefs.reminderTime}
          onPress={off || !prefs.dailyReminder ? undefined : () => setEditing('reminderTime')}
        />
        <CardDivider />
        <SwitchRow
          icon="flame-outline"
          label="Racha en riesgo"
          description="Te avisa si el día se acaba y todavía no estudiaste"
          value={prefs.streakAlert}
          onValueChange={(value) => update('streakAlert', value)}
          disabled={off}
        />
        <CardDivider />
        <SwitchRow
          icon="calendar-outline"
          label="Próximos exámenes"
          description="Un aviso el día anterior a cada examen de tu calendario"
          value={prefs.examReminder}
          onValueChange={(value) => update('examReminder', value)}
          disabled={off}
        />
      </Card>

      <SectionTitle>Novedades y familia</SectionTitle>
      <Card>
        <SwitchRow
          icon="sparkles-outline"
          label="Nuevas lecciones"
          description="Cuando Foxy aprenda a hacer algo nuevo"
          value={prefs.newLessons}
          onValueChange={(value) => update('newLessons', value)}
          disabled={off}
        />
        <CardDivider />
        <SwitchRow
          icon="mail-outline"
          label="Resumen semanal"
          description="Un correo con tu avance al adulto responsable"
          value={prefs.weeklyReport}
          onValueChange={(value) => update('weeklyReport', value)}
          disabled={off}
        />
      </Card>

      <SectionTitle>Horario de silencio</SectionTitle>
      <Card>
        <SwitchRow
          icon="moon-outline"
          label="No molestar"
          description="Nada de avisos durante estas horas"
          value={prefs.quietHours}
          onValueChange={(value) => update('quietHours', value)}
          disabled={off}
        />
        <CardDivider />
        <Row
          icon="bed-outline"
          label="Desde"
          value={prefs.quietFrom}
          onPress={off || !prefs.quietHours ? undefined : () => setEditing('quietFrom')}
        />
        <CardDivider />
        <Row
          icon="sunny-outline"
          label="Hasta"
          value={prefs.quietTo}
          onPress={off || !prefs.quietHours ? undefined : () => setEditing('quietTo')}
        />
      </Card>

      <Note icon="phone-portrait-outline">
        Los avisos se activarán de verdad cuando conectemos el servicio de notificaciones. Por ahora
        tus preferencias quedan guardadas en este dispositivo.
      </Note>

      <PromptModal
        visible={editing !== null}
        title={editing ? TIME_LABELS[editing] : ''}
        description="Escríbela en formato de 24 horas, por ejemplo 18:30."
        placeholder="18:00"
        initialValue={editing ? prefs[editing] : ''}
        maxLength={5}
        onCancel={() => setEditing(null)}
        onSave={handleSaveTime}
      />
    </ScreenShell>
  );
}
