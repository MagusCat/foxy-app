import React from 'react';
import { Linking, Text, View } from 'react-native';

import { Card, CardDivider, Note, Row, ScreenShell, SectionTitle } from '@/components/settings-ui';
import { appAlert } from '@/features/shared/components/overlay';
import { clearPersistedState, STORAGE_KEYS } from '@/hooks/use-persistent-state';
import { deleteAllMedia } from '@/lib/media';

const STORED_HERE = [
  'Tu nombre y tu foto de perfil',
  'Materias, escuela, grado y cuadernos',
  'Exámenes creados y tu actividad de estudio',
  'Eventos del calendario y tus preferencias',
];

export default function PrivacyScreen() {
  const handleResetData = () => {
    appAlert(
      'Borrar mis datos',
      'Se eliminarán tus materias, exámenes, actividad, eventos y preferencias guardadas en este dispositivo. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await clearPersistedState(STORAGE_KEYS);
            deleteAllMedia();
            appAlert('Datos borrados', 'Tu información en este dispositivo quedó como al inicio.');
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Privacidad y datos" subtitle="Qué guarda Fox y dónde">
      <Card>
        <View className="p-4">
          <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
            Todo se queda en tu teléfono
          </Text>
          <Text className="mt-1.5 text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
            Fox todavía no tiene cuentas en línea, así que nada de lo que escribes, fotografías o
            adjuntas sale de este dispositivo. Cuando eso cambie, te lo diremos antes y podrás
            decidir.
          </Text>
        </View>
      </Card>

      <SectionTitle>Qué se guarda</SectionTitle>
      <Card>
        <View className="gap-2.5 p-4">
          {STORED_HERE.map((item) => (
            <Text
              key={item}
              className="text-[13px] leading-[18px] text-text-primary-light dark:text-text-primary-dark"
            >
              •  {item}
            </Text>
          ))}
        </View>
      </Card>
      <Note>
        Las fotos y archivos que adjuntas se copian dentro de Fox, solo en este dispositivo, y se
        borran cuando eliminas el examen, cuaderno o conversación donde los pusiste —o cuando borras
        tus datos.
      </Note>

      <SectionTitle>Permisos</SectionTitle>
      <Card>
        <Row
          icon="camera-outline"
          label="Cámara y fotos"
          description="Se piden solo cuando adjuntas algo"
          value="Ajustes"
          onPress={() => Linking.openSettings()}
        />
        <CardDivider />
        <Row
          icon="document-outline"
          label="Términos y condiciones"
          onPress={() =>
            appAlert(
              'Términos y condiciones',
              'Se publicarán junto con las cuentas en línea. Mientras tanto, Fox no recopila ni comparte ningún dato.',
            )
          }
        />
      </Card>

      <SectionTitle>Tus datos</SectionTitle>
      <Card>
        <Row
          icon="download-outline"
          label="Exportar mis datos"
          description="Disponible cuando existan las cuentas"
          onPress={() =>
            appAlert(
              'Exportar mis datos',
              'Podrás descargar todo tu historial en cuanto conectemos las cuentas en línea.',
            )
          }
        />
        <CardDivider />
        <Row
          icon="trash-outline"
          danger
          label="Borrar mis datos"
          description="Elimina todo lo guardado en este dispositivo"
          onPress={handleResetData}
        />
      </Card>

      <Note icon="shield-checkmark-outline">
        Fox no muestra anuncios ni usa tu información para publicidad. Nunca.
      </Note>
    </ScreenShell>
  );
}
