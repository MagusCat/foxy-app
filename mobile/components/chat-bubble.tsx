import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useTheme } from '@/contexts/theme-context';
import type { ChatMessage } from '@/hooks/use-chat';

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${date.getHours()}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

/** Un mensaje del hilo: los tuyos a la derecha, los de Foxy a la izquierda. */
export function ChatBubble({ message, accent }: { message: ChatMessage; accent: string }) {
  const { colors, isDark } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View className={`mb-3 max-w-[86%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      {isUser ? null : (
        <View className="mb-1 flex-row items-center">
          <Text style={{ fontSize: 13 }}>🦊</Text>
          <Text className="ml-1.5 text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            Foxy
          </Text>
        </View>
      )}

      <View
        className={`rounded-[18px] px-3.5 py-2.5 ${isUser ? 'rounded-br-md' : 'rounded-bl-md border'}`}
        style={
          isUser
            ? { backgroundColor: accent }
            : { backgroundColor: colors.card, borderColor: colors.cardBorder }
        }
      >
        {message.attachments && message.attachments.length > 0 ? (
          <View className="mb-2 flex-row flex-wrap gap-1.5">
            {message.attachments.map((attachment) =>
              attachment.kind === 'image' ? (
                <Image
                  key={attachment.uri}
                  source={{ uri: attachment.uri }}
                  style={{ height: 74, width: 74, borderRadius: 12 }}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                <View
                  key={attachment.uri}
                  className="flex-row items-center rounded-xl px-2.5 py-2"
                  style={{ backgroundColor: isUser ? '#FFFFFF25' : colors.surface }}
                >
                  <Ionicons
                    name="document-text"
                    size={14}
                    color={isUser ? '#FFFFFF' : '#FBBF24'}
                  />
                  <Text
                    className="ml-1.5 max-w-[150px] text-[11px] font-medium"
                    style={{ color: isUser ? '#FFFFFF' : colors.text }}
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                </View>
              ),
            )}
          </View>
        ) : null}

        {message.text ? (
          <Text
            className="text-[14px] leading-[20px]"
            style={{ color: isUser ? '#FFFFFF' : colors.text }}
          >
            {message.text}
          </Text>
        ) : null}
      </View>

      <Text
        className="mt-1 px-1 text-[10px]"
        style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
      >
        {formatTime(message.at)}
      </Text>
    </View>
  );
}
