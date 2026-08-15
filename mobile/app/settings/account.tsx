import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AvatarEditor } from '@/components/avatar-editor';
import {
  Card,
  CardDivider,
  ChipGroup,
  Note,
  PromptModal,
  Row,
  ScreenShell,
  SectionTitle,
} from '@/components/settings-ui';
import { useTheme } from '@/contexts/theme-context';
import { clearPersistedState, usePersistentState, SESSION_KEYS } from '@/hooks/use-persistent-state';
import { useSubscription } from '@/hooks/use-subscription';

type EditableField = 'name' | 'guardianEmail' | null;

const AGE_RANGES = [
  { value: 'menor13', label: 'Menos de 13' },
  { value: '13a15', label: '13 a 15' },
  { value: '16a17', label: '16 a 17' },
  { value: 'mayor18', label: '18 o más' },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { plan } = useSubscription();

  const [userName, setUserName] = usePersistentState('foxy:user-name', 'Usuario');
  const [account, setAccount] = usePersistentState('foxy:account', {
    guardianEmail: '',
    ageRange: '13a15' as (typeof AGE_RANGES)[number]['value'],
  });

  const [editing, setEditing] = useState<EditableField>(null);

  const handleSave = (value: string) => {
    if (editing === 'name') setUserName(value);
    if (editing === 'guardianEmail') setAccount((prev) => ({ ...prev, guardianEmail: value }));
    setEditing(null);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Las cuentas en línea todavía no existen: por ahora todo vive en este dispositivo. Cuando estén listas, aquí podrás pedir la eliminación definitiva.',
      [
        { text: 'Entendido', style: 'cancel' },
        {
          text: 'Borrar lo de este equipo',
          style: 'destructive',
          onPress: async () => {
            await clearPersistedState(SESSION_KEYS);
            Alert.alert('Listo', 'Se borró tu información de este dispositivo.');
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Mi cuenta" subtitle="Tus datos y cómo te ve Foxy">
      <View
        className="mt-2 flex-row items-center rounded-2xl border p-4"
        style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      >
        <AvatarEditor name={userName} size={68} />
        <View className="ml-4 flex-1">
          <Text
            className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {userName}
          </Text>
          <Text className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Toca la foto para cambiarla
          </Text>
        </View>
      </View>

      <SectionTitle>Datos</SectionTitle>
      <Card>
        <Row
          icon="person-outline"
          label="Nombre"
          description="Así te saluda Foxy"
          value={userName}
          onPress={() => setEditing('name')}
        />
        <CardDivider />
        <Row
          icon="mail-outline"
          label="Correo de un adulto"
          description="Para avisos de plan y resumen de tu avance"
          value={account.guardianEmail || 'Sin agregar'}
          onPress={() => setEditing('guardianEmail')}
        />
        <CardDivider />
        <Row
          icon="card-outline"
          color={plan.color}
          label="Mi plan"
          value={plan.name}
          onPress={() => router.push('/subscription')}
        />
      </Card>

      <SectionTitle>Mi edad</SectionTitle>
      <Card>
        <View className="p-3.5">
          <Text className="mb-2.5 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
            Foxy ajusta sus explicaciones y el contenido que muestra según tu edad.
          </Text>
          <ChipGroup
            options={AGE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
            selected={account.ageRange}
            onSelect={(value) => setAccount((prev) => ({ ...prev, ageRange: value }))}
          />
        </View>
      </Card>
      <Note icon="shield-checkmark-outline">
        Si tienes menos de 13 años, Fox pide siempre la autorización de mamá, papá o tu tutor para
        cualquier cambio de plan.
      </Note>

      <SectionTitle>Zona delicada</SectionTitle>
      <Card>
        <Row
          icon="close-circle-outline"
          danger
          label="Eliminar mi cuenta"
          description="Disponible cuando existan las cuentas en línea"
          onPress={handleDeleteAccount}
        />
      </Card>
      <Note icon="lock-closed-outline">
        Para borrar lo que Fox guarda en este teléfono, ve a Privacidad y datos.
      </Note>

      <PromptModal
        visible={editing === 'name'}
        title="¿Cómo te llamas?"
        description="Así te saludará Foxy en la pantalla de inicio."
        placeholder="Tu nombre"
        initialValue={userName}
        maxLength={24}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />

      <PromptModal
        visible={editing === 'guardianEmail'}
        title="Correo de un adulto"
        description="Ahí llegarán los avisos de plan y el resumen semanal de tu avance."
        placeholder="mama@correo.com"
        initialValue={account.guardianEmail}
        keyboardType="email-address"
        allowEmpty
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    </ScreenShell>
  );
}
