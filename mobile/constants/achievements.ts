import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  progress: number;
  target: number;
  unlocked: boolean;
};

export type AchievementGroup = {
  title: string;
  items: Achievement[];
};

type Source = {
  streakBest: number;
  totalSessions: number;
  totalMinutes: number;
  subjectsStudied: number;
  examsCreated: number;
  eventsPlanned: number;
  savedQuestions: number;
  goalsMet: number;
};

function make(
  id: string,
  title: string,
  description: string,
  icon: keyof typeof Ionicons.glyphMap,
  color: string,
  progress: number,
  target: number,
): Achievement {
  const clamped = Math.min(progress, target);
  return { id, title, description, icon, color, progress: clamped, target, unlocked: clamped >= target };
}

export function buildAchievements(source: Source): AchievementGroup[] {
  return [
    {
      title: 'Constancia',
      items: [
        make('racha-1', 'Primer paso', 'Estudia un día con Foxy', 'footsteps-outline', Palette.flameOrange, source.streakBest, 1),
        make('racha-7', 'Semana completa', 'Consigue 7 días seguidos', 'flame-outline', Palette.flameOrange, source.streakBest, 7),
        make('racha-30', 'Mes de fuego', 'Consigue 30 días seguidos', 'flame', '#EA580C', source.streakBest, 30),
        make('racha-100', 'Centenario', 'Consigue 100 días seguidos', 'trophy-outline', '#F59E0B', source.streakBest, 100),
      ],
    },
    {
      title: 'Estudio',
      items: [
        make('sesiones-1', 'Primera duda', 'Hazle tu primera pregunta a Foxy', 'chatbubble-outline', Palette.accentBlue, source.totalSessions, 1),
        make('sesiones-10', 'Preguntón', 'Completa 10 sesiones de estudio', 'chatbubbles-outline', Palette.accentBlue, source.totalSessions, 10),
        make('minutos-60', 'Una hora', 'Acumula 60 minutos de estudio', 'time-outline', Palette.accentPurple, source.totalMinutes, 60),
        make('minutos-600', 'Diez horas', 'Acumula 600 minutos de estudio', 'hourglass-outline', Palette.accentPurple, source.totalMinutes, 600),
      ],
    },
    {
      title: 'Curiosidad',
      items: [
        make('materias-3', 'Mente abierta', 'Estudia 3 materias distintas', 'book-outline', '#10B981', source.subjectsStudied, 3),
        make('materias-6', 'Todoterreno', 'Estudia 6 materias distintas', 'library-outline', '#10B981', source.subjectsStudied, 6),
        make('guardadas-5', 'Coleccionista', 'Guarda 5 preguntas en tu historial', 'bookmark-outline', '#14B8A6', source.savedQuestions, 5),
      ],
    },
    {
      title: 'Organización',
      items: [
        make('examen-1', 'A practicar', 'Crea tu primer examen de práctica', 'document-text-outline', Palette.primary, source.examsCreated, 1),
        make('examen-5', 'Bien preparado', 'Crea 5 exámenes de práctica', 'school-outline', Palette.primary, source.examsCreated, 5),
        make('agenda-3', 'Con agenda', 'Agenda 3 eventos en tu calendario', 'calendar-outline', '#6366F1', source.eventsPlanned, 3),
        make('meta-5', 'Meta cumplida', 'Alcanza tu meta diaria 5 veces', 'checkmark-done-outline', '#EC4899', source.goalsMet, 5),
      ],
    },
  ];
}

export function countUnlocked(groups: AchievementGroup[]) {
  return groups.reduce(
    (totals, group) => {
      group.items.forEach((item) => {
        totals.total += 1;
        if (item.unlocked) totals.unlocked += 1;
      });
      return totals;
    },
    { unlocked: 0, total: 0 },
  );
}
