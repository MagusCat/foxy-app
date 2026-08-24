import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { AppHeader, TabHeader, useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert, useOverlay } from '@/features/shared/components/overlay';
import {
  roomVisibility,
  useClassrooms,
  VISIBILITY_META,
  type Classroom,
} from '@/hooks/use-classrooms';

export type { Classroom } from '@/hooks/use-classrooms';

function JoinRoomSheetContent({ close }: { close: () => void }) {
  const router = useGuardedRouter();
  const { colors } = useTheme();
  const { rooms } = useClassrooms();
  const [code, setCode] = useState('');

  const canJoin = code.trim().length === 6;

  const handleJoin = () => {
    const found = rooms.find((room) => room.code.toUpperCase() === code.trim().toUpperCase());
    close();

    if (found) {
      router.push({ pathname: '/class/[id]', params: { id: found.id } });
      return;
    }

    appAlert(
      'Código no encontrado',
      'Todavía no puedo buscar ese código — los códigos de otras personas se resolverán cuando existan las cuentas en línea.',
    );
  };

  return (
    <>
      <Text className="mb-4 text-center text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
        Pide el código de 6 caracteres a quien creó el cuaderno.
      </Text>
      <TextInput
        className="mb-5 rounded-2xl border px-4 py-4 text-center text-[22px] font-bold text-text-primary-light dark:text-text-primary-dark"
        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder, letterSpacing: 8 }}
        placeholder="ABCDEF"
        placeholderTextColor={colors.icon}
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase().slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={canJoin ? handleJoin : undefined}
      />
      <TouchableOpacity
        className="items-center rounded-2xl bg-primary px-5 py-3.5"
        style={canJoin ? undefined : { opacity: 0.5 }}
        disabled={!canJoin}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Unirme"
        onPress={handleJoin}
      >
        <Text className="text-sm font-bold text-white">Unirme</Text>
      </TouchableOpacity>
    </>
  );
}

export default function ClassScreen() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const { isDark, colors } = useTheme();
  const { showSheet } = useOverlay();

  const { rooms, removeRoom } = useClassrooms();

  const openJoinSheet = () =>
    showSheet({ title: 'Unirme a un cuaderno', render: (close) => <JoinRoomSheetContent close={close} /> });

  const handleDelete = (room: Classroom) => {
    appAlert(
      'Eliminar cuaderno',
      `¿Seguro que quieres eliminar "${room.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeRoom(room.id),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <AppHeader />

      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: padding.tabBottom }}
        showsVerticalScrollIndicator={false}
      >
        <TabHeader
          title={rooms.length > 0 ? `Mis cuadernos - ${rooms.length}` : 'Mis cuadernos'}
          subtitle={
            rooms.length > 0
              ? 'Tus materias organizadas en cuadernos'
              : 'Organiza tus materias en cuadernos'
          }
        />

        <View className="flex-row gap-2.5">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-full py-2.5"
            style={{ backgroundColor: Palette.primary }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Crear cuaderno"
            onPress={() => router.push('/class/new')}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text className="text-[14px] font-bold text-white">Crear cuaderno</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-full border py-2.5"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Unirme a un cuaderno"
            onPress={openJoinSheet}
          >
            <Ionicons name="enter-outline" size={17} color={colors.text} style={{ marginRight: 5 }} />
            <Text className="text-[14px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Unirme
            </Text>
          </TouchableOpacity>
        </View>

        {rooms.length === 0 ? (
          <View
            className="mt-5 items-center rounded-[24px] border px-6 py-10"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: softTint(Palette.primary, isDark) }}
            >
              <Text className="text-3xl">🦊</Text>
            </View>
            <Text className="mb-2 text-center text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              Aún no tienes cuadernos
            </Text>
            <Text className="mb-5 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
              Crea un cuaderno para agrupar tus apuntes, tareas y anuncios por materia. Foxy los usará
              para darte ayuda más precisa.
            </Text>
            <TouchableOpacity
              className="flex-row items-center rounded-2xl px-5 py-3"
              style={{ backgroundColor: Palette.primary }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Crear mi primer cuaderno"
              onPress={() => router.push('/class/new')}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text className="text-[13px] font-semibold text-white">Crear mi primer cuaderno</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mt-5">
            {rooms.map((room) => {
              const accent = getSubjectAccent(room.subject || room.name, isDark);
              const visibility = VISIBILITY_META[roomVisibility(room)];
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
                        {room.subject ? (
                          <Text
                            className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
                            numberOfLines={1}
                          >
                            {room.subject}
                          </Text>
                        ) : null}
                      </View>

                      <View className="flex-row items-center gap-1">
                        <TouchableOpacity
                          className="h-9 w-9 items-center justify-center rounded-full"
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Editar ${room.name}`}
                          onPress={() => router.push({ pathname: '/class/new', params: { id: room.id } })}
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

                    <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
                      <View className="flex-row items-center">
                        <Ionicons name={visibility.icon} size={13} color={colors.icon} />
                        <Text className="ml-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                          {visibility.label}
                        </Text>
                      </View>

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
                          className="rounded-full px-2 py-0.5"
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
    </View>
  );
}
