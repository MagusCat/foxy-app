import React from 'react';
import { Text, View } from 'react-native';

import {
  Card,
  CardDivider,
  ChipGroup,
  Note,
  Row,
  ScreenShell,
  SectionTitle,
  SwitchRow,
} from '@/components/settings-ui';
import {
  DEFAULT_LEARNING_PREFS,
  useLearningPrefs,
  type LearningPrefs,
} from '@/hooks/use-learning-prefs';

/** Bloque de "título + descripción + opciones", que se repite en toda la pantalla. */
function PrefBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View className="p-3.5">
      <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
        {title}
      </Text>
      <Text className="mb-2.5 mt-0.5 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
        {description}
      </Text>
      {children}
    </View>
  );
}

export default function LearningScreen() {
  const [prefs, setPrefs] = useLearningPrefs();

  const update = <K extends keyof LearningPrefs>(key: K, value: LearningPrefs[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <ScreenShell title="Preferencias de aprendizaje" subtitle="Cómo quieres que Foxy te explique">
      <SectionTitle>Cómo explica Foxy</SectionTitle>
      <Card>
        <PrefBlock
          title="Estilo de explicación"
          description="La forma en la que Foxy desarrolla una respuesta."
        >
          <ChipGroup
            options={[
              { value: 'pasos', label: 'Paso a paso' },
              { value: 'directo', label: 'Directo al grano' },
              { value: 'ejemplos', label: 'Con ejemplos' },
            ]}
            selected={prefs.style}
            onSelect={(value) => update('style', value)}
          />
        </PrefBlock>

        <CardDivider />

        <PrefBlock title="Nivel" description="Qué tanto detalle y vocabulario técnico usar.">
          <ChipGroup
            options={[
              { value: 'basico', label: 'Básico' },
              { value: 'intermedio', label: 'Intermedio' },
              { value: 'avanzado', label: 'Avanzado' },
            ]}
            selected={prefs.level}
            onSelect={(value) => update('level', value)}
          />
        </PrefBlock>

        <CardDivider />

        <PrefBlock title="Tono" description="La personalidad con la que Foxy te habla.">
          <ChipGroup
            options={[
              { value: 'amigable', label: 'Amigable' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'motivador', label: 'Motivador' },
            ]}
            selected={prefs.tone}
            onSelect={(value) => update('tone', value)}
          />
        </PrefBlock>

        <CardDivider />

        <PrefBlock title="Idioma" description="El idioma de las respuestas de Foxy.">
          <ChipGroup
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'Inglés' },
            ]}
            selected={prefs.language}
            onSelect={(value) => update('language', value)}
          />
        </PrefBlock>
      </Card>

      <SectionTitle>Mi meta diaria</SectionTitle>
      <Card>
        <PrefBlock
          title="Minutos de estudio al día"
          description="Se usa para medir tu progreso y mantener la racha."
        >
          <ChipGroup
            options={[
              { value: '10', label: '10 min' },
              { value: '20', label: '20 min' },
              { value: '30', label: '30 min' },
              { value: '45', label: '45 min' },
            ]}
            selected={`${prefs.dailyGoal}`}
            onSelect={(value) => update('dailyGoal', Number(value))}
          />
        </PrefBlock>
      </Card>

      <SectionTitle>Al resolver ejercicios</SectionTitle>
      <Card>
        <SwitchRow
          icon="flash-outline"
          label="Solucionador"
          description="Muestra la solución completa además del procedimiento"
          value={prefs.showFullSolution}
          onValueChange={(value) => update('showFullSolution', value)}
        />
        <CardDivider />
        <SwitchRow
          icon="repeat-outline"
          label="Práctica extra"
          description="Al terminar, Foxy propone un ejercicio parecido"
          value={prefs.extraPractice}
          onValueChange={(value) => update('extraPractice', value)}
        />
        <CardDivider />
        <SwitchRow
          icon="eye-off-outline"
          label="Modo enfoque"
          description="Oculta lecciones sugeridas mientras estudias"
          value={prefs.focusMode}
          onValueChange={(value) => update('focusMode', value)}
        />
      </Card>

      <SectionTitle>Restablecer</SectionTitle>
      <Card>
        <Row
          icon="refresh-outline"
          label="Volver a los valores recomendados"
          description="Deja las preferencias como venían al instalar la app"
          onPress={() => setPrefs(DEFAULT_LEARNING_PREFS)}
        />
      </Card>

      <Note icon="sparkles-outline">
        Estas preferencias viajarán con tus preguntas en cuanto conectemos la IA, para que Foxy
        responda como tú prefieres desde el primer mensaje.
      </Note>
    </ScreenShell>
  );
}
