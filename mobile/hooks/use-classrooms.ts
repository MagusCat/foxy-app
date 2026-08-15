import { useCallback, useMemo } from 'react';

import { usePersistentState } from '@/hooks/use-persistent-state';

export const CLASSROOMS_KEY = 'foxy:classrooms';

export type ClassPostKind = 'anuncio' | 'tarea' | 'material';

export type ClassPost = {
  id: string;
  kind: ClassPostKind;
  author: string;
  text: string;
  at: string;
  due?: string;
};

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  teacher: string;
  schedule: string;
  code: string;
  posts?: ClassPost[];
};

export const POST_KIND_META: Record<
  ClassPostKind,
  { label: string; icon: 'megaphone-outline' | 'clipboard-outline' | 'document-attach-outline'; color: string }
> = {
  anuncio: { label: 'Anuncio', icon: 'megaphone-outline', color: '#3B82F6' },
  tarea: { label: 'Tarea', icon: 'clipboard-outline', color: '#F97316' },
  material: { label: 'Material', icon: 'document-attach-outline', color: '#10B981' },
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode() {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function useClassrooms() {
  const [rooms, setRooms, hydrated] = usePersistentState<Classroom[]>(CLASSROOMS_KEY, []);

  const updateRoom = useCallback(
    (id: string, update: (room: Classroom) => Classroom) =>
      setRooms((prev) => prev.map((room) => (room.id === id ? update(room) : room))),
    [setRooms],
  );

  const addPost = useCallback(
    (id: string, post: Omit<ClassPost, 'id' | 'at'>) =>
      updateRoom(id, (room) => ({
        ...room,
        posts: [
          {
            ...post,
            id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            at: new Date().toISOString(),
          },
          ...(room.posts ?? []),
        ],
      })),
    [updateRoom],
  );

  const removePost = useCallback(
    (id: string, postId: string) =>
      updateRoom(id, (room) => ({
        ...room,
        posts: (room.posts ?? []).filter((post) => post.id !== postId),
      })),
    [updateRoom],
  );

  return { rooms, setRooms, hydrated, updateRoom, addPost, removePost };
}

export function useClassroom(id?: string) {
  const store = useClassrooms();
  const room = useMemo(() => store.rooms.find((item) => item.id === id), [store.rooms, id]);
  return { ...store, room };
}
