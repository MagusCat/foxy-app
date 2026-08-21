import { useCallback, useEffect, useMemo } from 'react';

import { usePersistentState } from '@/hooks/use-persistent-state';

export const CONVERSATIONS_KEY = 'foxy:conversations';
const LEGACY_CHAT_KEY = 'foxy:chat';

const MAX_MESSAGES = 200;
const TITLE_MAX_LENGTH = 42;

let didMigrate = false;

export type ChatAttachment = {
  kind: 'image' | 'file';
  name: string;
  uri: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'foxy';
  text: string;
  subject: string;
  at: string;
  attachments?: ChatAttachment[];
};

export type Conversation = {
  id: string;
  subject: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

export type SubjectGroup = {
  subject: string;
  conversations: Conversation[];
  updatedAt: string;
};

const REPLIES = [
  (subject: string) =>
    `Ya tengo tu pregunta de ${subject}. Todavía no estoy conectado a la IA, así que aún no puedo resolverla: en cuanto lo esté, te la explico paso a paso aquí mismo.`,
  (subject: string) =>
    `Apuntado en ${subject}. Me falta la conexión con la IA para responderte de verdad; mientras tanto queda guardado en tus preguntas para no perderlo.`,
  (subject: string) =>
    `Recibido. Cuando conectemos la IA, esto de ${subject} será lo primero que trabajemos: te daré la explicación y ejercicios para practicar.`,
];

function replyFor(subject: string, attachments: number, index: number) {
  const base = REPLIES[index % REPLIES.length](subject);
  if (attachments === 0) return base;

  const noun = attachments === 1 ? 'el archivo' : `los ${attachments} archivos`;
  return `${base}\n\nTambién guardé ${noun} que me enviaste.`;
}

export function titleFromQuestion(text: string, subject: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `Apuntes de ${subject}`;
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;

  const cut = trimmed.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

function migrateLegacy(legacy: ChatMessage[]): Conversation[] {
  const bySubject = new Map<string, ChatMessage[]>();
  legacy.forEach((message) => {
    const list = bySubject.get(message.subject) ?? [];
    list.push(message);
    bySubject.set(message.subject, list);
  });

  return [...bySubject.entries()].map(([subject, messages], index) => {
    const firstQuestion = messages.find((message) => message.role === 'user');
    const last = messages[messages.length - 1];
    return {
      id: `conv-${Date.now()}-${index}`,
      subject,
      title: firstQuestion ? titleFromQuestion(firstQuestion.text, subject) : `Apuntes de ${subject}`,
      messages,
      updatedAt: last?.at ?? new Date().toISOString(),
    };
  });
}

export function useChat() {
  const [conversations, setConversations, hydrated] = usePersistentState<Conversation[]>(
    CONVERSATIONS_KEY,
    [],
  );
  const [legacy, setLegacy] = usePersistentState<ChatMessage[]>(LEGACY_CHAT_KEY, []);

  useEffect(() => {
    if (!hydrated || didMigrate || legacy.length === 0) return;
    didMigrate = true;

    setConversations((prev) => [...migrateLegacy(legacy), ...prev]);
    setLegacy([]);
  }, [hydrated, legacy, setConversations, setLegacy]);

  const send = useCallback(
    (text: string, subject: string, attachments: ChatAttachment[] = [], target?: string) => {
      const now = Date.now();
      const message: ChatMessage = {
        id: `msg-${now}`,
        role: 'user',
        text,
        subject,
        at: new Date(now).toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const existing = target
        ? conversations.find((conversation) => conversation.id === target && conversation.subject === subject)
        : undefined;
      const id = existing?.id ?? `conv-${now}`;

      setConversations((prev) => {
        if (existing) {
          return prev.map((conversation) =>
            conversation.id === id
              ? {
                  ...conversation,
                  messages: [...conversation.messages, message].slice(-MAX_MESSAGES),
                  updatedAt: message.at,
                }
              : conversation,
          );
        }

        const created: Conversation = {
          id,
          subject,
          title: titleFromQuestion(text, subject),
          messages: [message],
          updatedAt: message.at,
        };
        return [created, ...prev];
      });

      return id;
    },
    [conversations, setConversations],
  );

  const answer = useCallback(
    (id: string, attachments: number) => {
      setConversations((prev) => {
        const conversation = prev.find((item) => item.id === id);
        if (!conversation) return prev;

        const previousAnswers = conversation.messages.filter((message) => message.role === 'foxy').length;
        const reply: ChatMessage = {
          id: `msg-${Date.now()}-foxy`,
          role: 'foxy',
          text: replyFor(conversation.subject, attachments, previousAnswers),
          subject: conversation.subject,
          at: new Date().toISOString(),
        };

        return prev.map((item) =>
          item.id === id
            ? { ...item, messages: [...item.messages, reply].slice(-MAX_MESSAGES), updatedAt: reply.at }
            : item,
        );
      });
    },
    [setConversations],
  );

  const remove = useCallback((id: string) => {
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
  }, [setConversations]);

  const clearAll = useCallback(() => setConversations([]), [setConversations]);

  const groups = useMemo<SubjectGroup[]>(() => {
    const bySubject = new Map<string, Conversation[]>();
    conversations.forEach((conversation) => {
      const list = bySubject.get(conversation.subject) ?? [];
      list.push(conversation);
      bySubject.set(conversation.subject, list);
    });

    return [...bySubject.entries()]
      .map(([subject, items]) => {
        const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { subject, conversations: sorted, updatedAt: sorted[0].updatedAt };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [conversations]);

  return { conversations, groups, hydrated, send, answer, remove, clearAll };
}
