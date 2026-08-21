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

export type RoomVisibility = 'publico' | 'privado';

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  code: string;
  // Opcionales: los cuadernos creados antes de esta versión no los traen.
  days?: string[];
  time?: string;
  visibility?: RoomVisibility;
  posts?: ClassPost[];
};

export const CLASS_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const VISIBILITY_META: Record<
  RoomVisibility,
  { label: string; hint: string; icon: 'earth-outline' | 'lock-closed-outline' }
> = {
  publico: {
    label: 'Cuaderno público',
    hint: 'Cualquiera con el código puede unirse',
    icon: 'earth-outline',
  },
  privado: {
    label: 'Cuaderno privado',
    hint: 'Solo entra quien tú invites',
    icon: 'lock-closed-outline',
  },
};

/** Los cuadernos antiguos no guardaban visibilidad: se asumen privados. */
export function roomVisibility(room: Classroom): RoomVisibility {
  return room.visibility ?? 'privado';
}

export function composeSchedule(days: string[]) {
  const ordered = CLASS_DAYS.filter((day) => days.includes(day));
  if (ordered.length === 0) return '';
  if (ordered.length === 1) return ordered[0];
  return `${ordered.slice(0, -1).join(', ')} y ${ordered[ordered.length - 1]}`;
}

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
