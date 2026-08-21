import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { useScreenPadding } from '@/components/screen-header';
import { getSubjectAccent } from '@/constants/subject-colors';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

import { ChatBubble } from '../components/chat-bubble';
import { ChatComposer } from '../components/chat-composer';
import { useChat, type Conversation, type SubjectGroup } from '../hooks/use-chat';

const REPLY_DELAY_MS = 900;

function describeLastMessage(conversation: Conversation) {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return '';
  const text = last.text || (last.attachments?.length ? 'Adjuntos enviados' : '');
  return last.role === 'foxy' ? `Foxy: ${text}` : text;
}

function ConversationRow({ conversation, onPress, onRemove }: {
  conversation: Conversation;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, isDark } = useTheme();
  const accent = getSubjectAccent(conversation.subject, isDark);

  const handleLongPress = () =>
    appAlert('Eliminar conversación', `¿Quitar "${conversation.title}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onRemove },
    ]);

  return (
    <TouchableOpacity
      className="mb-2 flex-row items-center rounded-2xl border p-3.5"
      style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${conversation.title}, ${conversation.messages.length} mensajes`}
      accessibilityHint="Mantén pulsado para eliminar"
      onPress={onPress}
      onLongPress={handleLongPress}
    >
      <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent.color }} />
      <View className="flex-1 pr-2">
        <Text
          className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
          numberOfLines={1}
        >
          {conversation.title}
        </Text>
        <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark" numberOfLines={1}>
          {describeLastMessage(conversation)}
        </Text>
      </View>
      <Text className="mr-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
        {conversation.messages.length}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={colors.icon} />
    </TouchableOpacity>
  );
}

function SubjectSection({ group, expanded, onToggle, onOpenConversation, onRemoveConversation }: {
  group: SubjectGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenConversation: (id: string) => void;
  onRemoveConversation: (id: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const accent = getSubjectAccent(group.subject, isDark);

  return (
    <View className="mb-2.5 overflow-hidden rounded-2xl border" style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}>
      <TouchableOpacity
        className="flex-row items-center p-4"
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
      >
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: accent.soft }}
        >
          <Ionicons name="book" size={17} color={accent.color} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
            {group.subject}
          </Text>
          <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
            {group.conversations.length} {group.conversations.length === 1 ? 'tema' : 'temas'}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.icon} />
      </TouchableOpacity>

      {expanded ? (
        <View className="px-3 pb-3">
          {group.conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              onPress={() => onOpenConversation(conversation.id)}
              onRemove={() => onRemoveConversation(conversation.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ChatScreen() {
  const { id, scan } = useLocalSearchParams<{ id?: string; scan?: string }>();
  const router = useGuardedRouter();
  const padding = useScreenPadding();
  const { colors, isDark } = useTheme();

  const { conversations, groups, answer, remove } = useChat();
  const keyboardHeight = useKeyboardHeight();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const hasInitializedExpanded = useRef(false);
  const threadRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (hasInitializedExpanded.current || groups.length === 0) return;
    hasInitializedExpanded.current = true;
    setExpandedSubject(groups[0].subject);
  }, [groups]);

  const conversation = id ? conversations.find((item) => item.id === id) : undefined;
  const lastMessage = conversation?.messages[conversation.messages.length - 1];

  useEffect(() => {
    if (!conversation || lastMessage?.role !== 'user') return;
    const attachmentsCount = lastMessage.attachments?.length ?? 0;
    const timer = setTimeout(() => answer(conversation.id, attachmentsCount), REPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [conversation?.id, lastMessage?.id, lastMessage?.role, answer]);

  const handleRemove = (conversationId: string) => {
    if (conversationId === id) router.back();
    remove(conversationId);
  };

  if (conversation) {
    const accent = getSubjectAccent(conversation.subject, isDark);
    return (
      <View className="flex-1 bg-bg-light dark:bg-bg-dark">
        <View className="flex-row items-center px-5 pb-3" style={{ paddingTop: padding.top }}>
          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full border"
            style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver a mis conversaciones"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text
            className="ml-3 flex-1 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {conversation.title}
          </Text>
        </View>

        <ScrollView
          ref={threadRef}
          className="px-5"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
        >
          <View className="pt-1">
            {conversation.messages.map((message) => (
              <ChatBubble key={message.id} message={message} accent={accent.color} />
            ))}

            {lastMessage?.role === 'user' ? (
              <View className="mb-3 mr-auto max-w-[86%] flex-row items-center rounded-[18px] rounded-bl-md border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark">
                <Text style={{ fontSize: 15 }}>🦊</Text>
                <Text className="ml-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                  Foxy está escribiendo…
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={{ paddingBottom: keyboardHeight > 0 ? 0 : padding.stackBottom }}>
          <ChatComposer
            onSent={(newId) => {
              if (newId !== conversation.id) {
                router.push({ pathname: '/chat', params: { id: newId } });
              }
            }}
            conversationId={conversation.id}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <View className="flex-row items-center px-5 pb-3" style={{ paddingTop: padding.top }}>
        <TouchableOpacity
          className="h-9 w-9 items-center justify-center rounded-full border"
          style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text className="ml-3 text-[22px] font-bold text-text-primary-light dark:text-text-primary-dark">
          Mis conversaciones
        </Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {groups.length === 0 ? (
          <View
            className="mt-4 items-center rounded-[20px] border px-5 py-9"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <Text style={{ fontSize: 28 }}>🦊</Text>
            <Text className="mt-2.5 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
              Todavía no tienes conversaciones. Escribe abajo y nacerá un tema para la materia que
              tengas elegida. El nombre lo toma de tu primera pregunta.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <SubjectSection
              key={group.subject}
              group={group}
              expanded={group.subject === expandedSubject}
              onToggle={() => setExpandedSubject((prev) => (prev === group.subject ? null : group.subject))}
              onOpenConversation={(conversationId) => router.push({ pathname: '/chat', params: { id: conversationId } })}
              onRemoveConversation={handleRemove}
            />
          ))
        )}
      </ScrollView>

      <View style={{ paddingBottom: keyboardHeight > 0 ? 0 : padding.stackBottom }}>
        <ChatComposer
          onSent={(conversationId) => router.push({ pathname: '/chat', params: { id: conversationId } })}
          autoCamera={scan === '1'}
        />
      </View>
    </View>
  );
}
