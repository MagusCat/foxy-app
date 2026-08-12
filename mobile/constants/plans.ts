import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';

export type PlanId = 'basico' | 'plus' | 'familia';

export type Plan = {
  id: PlanId;
  name: string;
  shortName: string;
  tagline: string;
  price: string;
  period: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  soft: [string, string];
  badge?: string;
  benefits: string[];
  missing?: string[];
};

export const BASIC_DAILY_QUESTIONS = 10;

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
    soft: ['#D1FAE5', '#122A22'],
    badge: 'Tu plan actual',
    benefits: [
      `${BASIC_DAILY_QUESTIONS} preguntas a Foxy cada día`,
      'Materias ilimitadas y racha de estudio',
      'Escanea problemas con la cámara',
      'Adjunta PDF y documentos de texto',
      'Teclado matemático completo',
      'Sin anuncios y sin compras dentro del chat',
    ],
    missing: ['Exámenes de práctica ilimitados', 'Lecciones en audio y modo voz'],
  },
  {
    id: 'plus',
    name: 'Fox Plus',
    shortName: 'Plus',
    tagline: 'Cuando quieres practicar todo lo que necesites.',
    price: '$79',
    period: 'al mes',
    icon: 'sparkles',
    color: Palette.accentBlue,
    soft: ['#DBEAFE', '#152238'],
    benefits: [
      'Preguntas y exámenes ilimitados',
      'Lecciones en audio, podcast y modo voz',
      'Planes de estudio para tus exámenes',
      'Explicaciones paso a paso más detalladas',
      'Resumen semanal de tu progreso',
    ],
  },
  {
    id: 'familia',
    name: 'Fox Familia',
    shortName: 'Familia',
    tagline: 'Todo lo de Plus para hasta 5 personas de la casa.',
    price: '$129',
    period: 'al mes',
    icon: 'home-outline',
    color: Palette.accentPurple,
    soft: ['#F3E8FF', '#241A33'],
    badge: 'Recomendado',
    benefits: [
      'Hasta 5 perfiles, uno por cada estudiante',
      'Panel para mamá, papá o tutor',
      'Resumen del avance directo a su correo',
      'Límites de tiempo de uso configurables',
      'Contenido revisado y apropiado para cada edad',
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}
