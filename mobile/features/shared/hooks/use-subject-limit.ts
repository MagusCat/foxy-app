import { useCallback } from 'react';

import { useOverlay } from '@/features/shared/components/overlay';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';
import { useSubscription } from '@/hooks/use-subscription';

/**
 * Un único sitio compartido por el alta de cuaderno, Mi cuenta y el
 * selector de materias del chat.
 *
 * Quien ya tuviera más materias que el tope las conserva: el límite solo
 * impide añadir una más, nunca borra las que ya existían. Por eso `warn`
 * dice "13 materias activas" en vez del absurdo "13 de 4" cuando alguien
 * ya pasó el tope.
 */
export function useSubjectLimit(selectedCount: number) {
  const router = useGuardedRouter();
  const { subjectLimit } = useSubscription();
  const { showDialog } = useOverlay();

  const limit = subjectLimit;
  const isFull = limit !== null && selectedCount >= limit;

  const warn =
    limit === null
      ? null
      : selectedCount > limit
        ? `${selectedCount} materias activas`
        : `${selectedCount} de ${limit} materias`;

  const guard = useCallback(
    (action: () => void) => {
      if (!isFull) {
        action();
        return;
      }
      showDialog({
        title: 'Llegaste al límite de materias',
        message: `Fox Básico incluye hasta ${limit} materias. Mejora tu plan para agregar más.`,
        actions: [
          { label: 'Ver planes', primary: true, onPress: () => router.push('/subscription') },
          { label: 'Ahora no' },
        ],
      });
    },
    [isFull, limit, showDialog, router],
  );

  return { limit, isFull, warn, guard };
}
