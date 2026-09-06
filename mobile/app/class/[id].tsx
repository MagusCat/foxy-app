import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { useAttachments } from '@/hooks/use-attachments';
import { usePersistentState } from '@/hooks/use-persistent-state';
import {
  POST_KIND_META,
  roomVisibility,
  useClassroom,
  VISIBILITY_META,
  type ClassPost,
  type ClassPostKind,
} from '@/hooks/use-classrooms';
import { persistMedia } from '@/lib/media';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

type Tab = 'tablon' | 'trabajo' | 'personas';

const TABS: { value: Tab; label: string }[] = [
  { value: 'tablon', label: 'Novedades' },
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'personas', label: 'Personas' },
];

const COMPOSER_KINDS: ClassPostKind[] = ['anuncio', 'tarea', 'material'];

function describeMoment(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

export default function ClassroomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const padding = useScreenPadding();
  const keyboardHeight = useKeyboardHeight();
  const router = useGuardedRouter();
  const { colors, isDark } = useTheme();

  const { room, addPost, removePost, hydrated } = useClassroom(id);
  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const {
    attachments,
    addFromCamera,
    addFromLibrary,
    addFromFiles,
    removeAttachment,
    clearAttachments,
  } = useAttachments();

  const [tab, setTab] = useState<Tab>('tablon');
  const [draft, setDraft] = useState('');
  const [draftKind, setDraftKind] = useState<ClassPostKind>('anuncio');
  const [isComposing, setComposing] = useState(false);

  if (!room && !hydrated) {
    return <View className="flex-1 bg-bg-light dark:bg-bg-dark" />;
  }

  if (!room) {
    return (
      <View
        className="flex-1 items-center justify-center bg-bg-light px-8 dark:bg-bg-dark"
        style={{ paddingTop: padding.top }}
      >
        <Ionicons name="people-outline" size={38} color={colors.icon} />
        <Text className="mt-3 text-center text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          Este cuaderno ya no existe
        </Text>
        <TouchableOpacity
          className="mt-5 rounded-full px-5 py-2.5"
          style={{ backgroundColor: Palette.primary }}
          onPress={() => router.replace('/(tabs)/class')}
        >
          <Text className="text-[13px] font-bold text-white">Ver mis cuadernos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = getSubjectAccent(room.subject || room.name, isDark);
  const posts = room.posts ?? [];
  const homework = posts.filter((post) => post.kind === 'tarea');
  const visiblePosts = tab === 'trabajo' ? homework : posts;

  const selectDraftKind = (kind: ClassPostKind) => {
    setDraftKind(kind);
    if (kind !== 'tarea') clearAttachments();
  };

  const publish = () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;

    addPost(room.id, {
      kind: draftKind,
      author: userName,
      text,
      ...(draftKind === 'tarea' && attachments.length > 0
        ? {
            attachments: attachments.map((item) => ({
              kind: item.kind,
              name: item.name,
              uri: persistMedia(item.uri, item.kind === 'image' ? 'post-img' : 'post-doc'),
            })),
          }
        : {}),
    });
    setDraft('');
    clearAttachments();
    setComposing(false);
  };

  const confirmRemove = (post: ClassPost) =>
    appAlert('Eliminar publicación', '¿Quitarla del tablón?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removePost(room.id, post.id) },
    ]);

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: padding.stackBottom + keyboardHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: padding.top,
            paddingHorizontal: 20,
            paddingBottom: 24,
            backgroundColor: accent.color,
          }}
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: '#00000040' }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-1" />

            <TouchableOpacity
              className="h-9 flex-row items-center rounded-full px-3.5"
              style={{ backgroundColor: '#00000040' }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Código del cuaderno ${room.code}`}
              onPress={() =>
                appAlert(
                  'Código del cuaderno',
                  `${room.code}\n\nCuando conectemos la app, tus compañeros podrán unirse a "${room.name}" con este código.`,
                )
              }
            >
              <Ionicons name="key-outline" size={13} color="#FFFFFF" />
              <Text className="ml-1.5 text-[13px] font-bold text-white">{room.code}</Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-6 text-[26px] font-bold leading-[33px] text-white" numberOfLines={2}>
            {room.name}
          </Text>
          {room.subject ? (
            <Text className="mt-1 text-[14px] text-white/80">{room.subject}</Text>
          ) : null}

          <View className="mt-3 flex-row flex-wrap gap-2">
            {room.schedule ? (
              <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: '#00000035' }}>
                <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                <Text className="ml-1.5 text-[12px] font-semibold text-white">{room.schedule}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row gap-2 px-5 pt-4">
          {TABS.map((item) => {
            const isActive = tab === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                className="h-10 flex-1 items-center justify-center rounded-full"
                style={{ backgroundColor: isActive ? colors.text : colors.surface }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setTab(item.value)}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: isActive ? colors.background : colors.text }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'personas' ? (
          <View className="mt-5 px-5">
            <View
              className="rounded-[20px] border"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <View className="flex-row items-center p-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: softTint(accent.color, isDark) }}
                >
                  <Text className="text-[16px] font-bold" style={{ color: accent.color }}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {userName}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    Tú
                  </Text>
                </View>
              </View>

              <View className="ml-[68px] h-px" style={{ backgroundColor: colors.cardBorder }} />
              <View className="flex-row items-center p-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name={VISIBILITY_META[roomVisibility(room)].icon} size={19} color={colors.text} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {VISIBILITY_META[roomVisibility(room)].label}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {VISIBILITY_META[roomVisibility(room)].hint}
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="mt-3 items-center rounded-[20px] border px-5 py-7"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons name="person-add-outline" size={26} color={colors.icon} />
              <Text className="mt-2.5 text-center text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                Invita a tus compañeros
              </Text>
              <Text className="mt-1 text-center text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                Comparte el código {room.code}. Podrán entrar en cuanto conectemos las cuentas en
                línea.
              </Text>
            </View>
          </View>
        ) : (
          <View className="mt-5 px-5">
            {isComposing ? (
              <View
                className="mb-4 rounded-[20px] border p-4"
                style={{ backgroundColor: colors.card, borderColor: accent.color }}
              >
                <View className="mb-3 flex-row gap-2">
                  {COMPOSER_KINDS.map((kind) => {
                    const meta = POST_KIND_META[kind];
                    const isActive = draftKind === kind;
                    return (
                      <TouchableOpacity
                        key={kind}
                        className="flex-row items-center rounded-full border px-3 py-1.5"
                        style={{
                          borderColor: isActive ? meta.color : colors.cardBorder,
                          backgroundColor: isActive ? softTint(meta.color, isDark) : 'transparent',
                        }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        onPress={() => selectDraftKind(kind)}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={13}
                          color={isActive ? meta.color : colors.icon}
                        />
                        <Text
                          className="ml-1.5 text-[12px] font-semibold"
                          style={{ color: isActive ? meta.color : colors.textSecondary }}
                        >
                          {meta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.cardBorder,
                    minHeight: 90,
                    textAlignVertical: 'top',
                  }}
                  placeholder={
                    draftKind === 'tarea'
                      ? 'Describe la tarea… puedes adjuntar archivos'
                      : 'Escribe algo para tu cuaderno…'
                  }
                  placeholderTextColor={colors.icon}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  autoFocus
                />

                {draftKind === 'tarea' ? (
                  <>
                    <View className="mt-3 flex-row items-center gap-2">
                      <TouchableOpacity
                        className="flex-row items-center rounded-full border px-3 py-1.5"
                        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Adjuntar desde la cámara"
                        onPress={addFromCamera}
                      >
                        <Ionicons name="camera-outline" size={14} color={colors.text} />
                        <Text className="ml-1.5 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                          Cámara
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center rounded-full border px-3 py-1.5"
                        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Adjuntar desde tus fotos"
                        onPress={addFromLibrary}
                      >
                        <Ionicons name="images-outline" size={14} color={colors.text} />
                        <Text className="ml-1.5 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                          Fotos
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center rounded-full border px-3 py-1.5"
                        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Adjuntar archivos"
                        onPress={addFromFiles}
                      >
                        <Ionicons name="folder-outline" size={14} color="#FBBF24" />
                        <Text className="ml-1.5 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                          Archivos
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {attachments.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mt-2 -mx-1"
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
                                style={{ height: 28, width: 28, borderRadius: 8 }}
                                contentFit="cover"
                                transition={120}
                              />
                            ) : (
                              <View className="h-7 w-7 items-center justify-center rounded-lg bg-card-light dark:bg-card-dark">
                                <Ionicons name="document-text-outline" size={15} color="#FBBF24" />
                              </View>
                            )}

                            <Text
                              className="mx-1.5 max-w-[130px] text-[11px] font-medium text-text-primary-light dark:text-text-primary-dark"
                              numberOfLines={1}
                              ellipsizeMode="tail"
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
                              <Ionicons name="close" size={14} color={colors.icon} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                  </>
                ) : null}

                <View className="mt-3 flex-row justify-end gap-2.5">
                  <TouchableOpacity
                    className="rounded-xl px-4 py-2.5"
                    onPress={() => {
                      setDraft('');
                      clearAttachments();
                      setComposing(false);
                    }}
                  >
                    <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-xl px-5 py-2.5"
                    style={{
                      backgroundColor: accent.color,
                      opacity: draft.trim() || attachments.length > 0 ? 1 : 0.45,
                    }}
                    disabled={!draft.trim() && attachments.length === 0}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Publicar"
                    onPress={publish}
                  >
                    <Text className="text-[13px] font-bold text-white">Publicar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                className="mb-4 flex-row items-center rounded-full border px-4 py-3.5"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Comparte algo con tu cuaderno"
                onPress={() => setComposing(true)}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: softTint(accent.color, isDark) }}
                >
                  <Text className="text-[13px] font-bold" style={{ color: accent.color }}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="ml-3 flex-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                  Comparte algo con tu cuaderno
                </Text>
                <Ionicons name="create-outline" size={18} color={colors.icon} />
              </TouchableOpacity>
            )}

            {visiblePosts.length === 0 ? (
              <View
                className="items-center rounded-[20px] border px-5 py-9"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              >
                <Text style={{ fontSize: 30 }}>🦊</Text>
                <Text className="mt-2.5 text-center text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {tab === 'trabajo' ? 'Sin tareas por ahora' : 'El tablón está vacío'}
                </Text>
                <Text className="mt-1 text-center text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                  {tab === 'trabajo'
                    ? 'Apunta aquí las tareas del cuaderno para no perderlas de vista.'
                    : 'Escribe el primer anuncio, apunta una tarea o guarda un material del cuaderno.'}
                </Text>
              </View>
            ) : (
              visiblePosts.map((post) => {
                const meta = POST_KIND_META[post.kind];
                return (
                  <View
                    key={post.id}
                    className="mb-3 rounded-[20px] border p-4"
                    style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: softTint(meta.color, isDark) }}
                      >
                        <Ionicons name={meta.icon} size={17} color={meta.color} />
                      </View>

                      <View className="ml-3 flex-1">
                        <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                          {post.author}
                        </Text>
                        <View className="mt-1 flex-row items-center gap-1.5">
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: softTint(meta.color, isDark) }}
                          >
                            <Text className="text-[10px] font-bold" style={{ color: meta.color }}>
                              {meta.label}
                            </Text>
                          </View>
                          <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {describeMoment(post.at)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        className="h-8 w-8 items-center justify-center rounded-full"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar publicación"
                        onPress={() => confirmRemove(post)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.icon} />
                      </TouchableOpacity>
                    </View>

                    <Text className="mt-3 text-[14px] leading-[20px] text-text-primary-light dark:text-text-primary-dark">
                      {post.text}
                    </Text>

                    {(post.attachments?.length ?? 0) > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mt-2.5 -mx-1"
                        contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                      >
                        {post.attachments!.map((file) => (
                          <View
                            key={file.uri}
                            className="flex-row items-center rounded-xl border border-card-light-border bg-surface-light py-1.5 pl-1.5 pr-2.5 dark:border-surface-dark-border dark:bg-surface-dark"
                          >
                            {file.kind === 'image' ? (
                              <Image
                                source={{ uri: file.uri }}
                                style={{ height: 28, width: 28, borderRadius: 8 }}
                                contentFit="cover"
                                transition={120}
                              />
                            ) : (
                              <View className="h-7 w-7 items-center justify-center rounded-lg bg-card-light dark:bg-card-dark">
                                <Ionicons name="document-text-outline" size={15} color="#FBBF24" />
                              </View>
                            )}
                            <Text
                              className="ml-1.5 max-w-[150px] text-[11px] font-medium text-text-primary-light dark:text-text-primary-dark"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {file.name}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
