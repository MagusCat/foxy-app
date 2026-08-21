import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';

export type PlanId = 'basico' | 'plus' | 'grupo';

export type Plan = {
  id: PlanId;
  name: string;
  shortName: string;
  tagline: string;
  price: string;
  period: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badge?: string;
  benefits: string[];
  missing?: string[];
};

export const BASIC_DAILY_QUESTIONS = 10;
export const BASIC_SUBJECT_LIMIT = 4;

export const PLANS: Plan[] = [
  {
    id: 'basico',
    name: 'Fox Básico',
    shortName: 'Básico',
    tagline: 'Para empezar a estudiar con Foxy sin pagar nada.',
    price: 'Gratis',
    period: 'para siempre',
    icon: 'leaf-outline',
    color: '#10B981',
    badge: 'Tu plan actual',
    benefits: [
      `${BASIC_DAILY_QUESTIONS} preguntas a Foxy cada día`,
      `${BASIC_SUBJECT_LIMIT} materias y racha de estudio`,
      'Escanea problemas con la cámara',
      'Adjunta PDF y documentos de texto',
      'Teclado matemático completo',
      'Sin anuncios y sin compras dentro del chat',
    ],
    missing: ['Materias ilimitadas', 'Exámenes de práctica ilimitados', 'Lecciones en audio y modo voz'],
  },
  {
    id: 'plus',
    name: 'Fox Plus',
    shortName: 'Plus',
    tagline: 'Cuando quieres practicar todo lo que necesites.',
    price: '$7',
    period: 'USD al mes',
    icon: 'sparkles',
    color: Palette.accentBlue,
    benefits: [
      'Materias, preguntas y exámenes ilimitados',
      'Lecciones en audio, podcast y modo voz',
      'Planes de estudio para tus exámenes',
      'Explicaciones paso a paso más detalladas',
      'Resumen semanal de tu progreso',
    ],
  },
  {
    id: 'grupo',
    name: 'Fox Grupo',
    shortName: 'Grupo',
    tagline: 'Todo lo de Plus para hasta 5 personas del mismo grupo.',
    price: '$25',
    period: 'USD al mes',
    icon: 'people-outline',
    color: Palette.accentPurple,
    badge: 'Recomendado',
    benefits: [
      'Hasta 5 perfiles, uno por cada estudiante',
      'Panel compartido para el grupo',
      'Resumen del avance directo a su correo',
      'Límites de tiempo de uso configurables',
      'Contenido revisado y apropiado para cada edad',
    ],
  },
];

// El id anterior de este plan era 'familia'. Quien lo tenga guardado en
// AsyncStorage debe seguir cayendo en Fox Grupo, no en Básico.
const LEGACY_PLAN_IDS: Record<string, PlanId> = { familia: 'grupo' };

export function getPlan(id: string): Plan {
  const resolved = LEGACY_PLAN_IDS[id] ?? id;
  return PLANS.find((plan) => plan.id === resolved) ?? PLANS[0];
}
