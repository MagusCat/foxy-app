import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Card, CardDivider, Note, Row, ScreenShell, SectionTitle } from '@/components/settings-ui';
import { ALLOWED_DOCUMENTS_LABEL } from '@/constants/attachments';
import { BASIC_DAILY_QUESTIONS } from '@/constants/plans';
import { useTheme } from '@/contexts/theme-context';

const FAQ = [
  {
    question: '¿Foxy ya responde mis preguntas?',
    answer:
      'Todavía no. La app está completa por fuera, pero la inteligencia artificial se conecta en la siguiente etapa. Mientras tanto, todo lo que escribes y adjuntas se guarda listo para enviarse.',
  },
  {
    question: '¿Qué archivos puedo adjuntar?',
    answer: `Fotos desde la cámara o la galería, y documentos en ${ALLOWED_DOCUMENTS_LABEL}. Iremos sumando más formatos conforme Foxy aprenda a leerlos.`,
  },
  {
    question: '¿Cómo funciona la racha?',
    answer:
      'Cada día que usas Fox suma un día a tu racha. Si dejas pasar un día completo, la racha vuelve a empezar, pero tu mejor marca se guarda para siempre.',
  },
  {
    question: '¿Cuántas preguntas tengo al día?',
    answer: `Con el plan gratuito tienes ${BASIC_DAILY_QUESTIONS} preguntas diarias, que se renuevan solas cada día a medianoche.`,
  },
  {
    question: '¿Necesito permiso para cambiar de plan?',
    answer:
      'Sí. Cualquier cambio de plan lo autoriza un adulto responsable, y nunca se cobra nada sin ese permiso.',
  },
  {
    question: '¿Dónde se guarda mi información?',
    answer:
      'Por ahora todo se queda en tu teléfono. No se sube nada a internet mientras no existan las cuentas en línea.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TouchableOpacity
      className="px-3.5 py-3"
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      onPress={() => setIsOpen((value) => !value)}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 pr-3 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          {question}
        </Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.icon} />
      </View>

      {isOpen ? (
        <Text className="mt-2 text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
          {answer}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const showSoon = (title: string, message: string) => Alert.alert(title, message);

  return (
    <ScreenShell title="Ayuda y soporte" subtitle="Resolvemos tus dudas sobre Fox">
      <SectionTitle>Preguntas frecuentes</SectionTitle>
      <Card>
        {FAQ.map((item, index) => (
          <React.Fragment key={item.question}>
            {index > 0 ? <View className="ml-3.5 h-px bg-black/5 dark:bg-white/5" /> : null}
            <FaqItem question={item.question} answer={item.answer} />
          </React.Fragment>
        ))}
      </Card>

      <SectionTitle>Contáctanos</SectionTitle>
      <Card>
        <Row
          icon="chatbubble-ellipses-outline"
          label="Escribir a soporte"
          description="Te respondemos en menos de 24 horas hábiles"
          onPress={() =>
            showSoon(
              'Soporte de Fox',
              'El chat de soporte se activa junto con las cuentas. Mientras tanto puedes escribirnos a hola@fox.app.',
            )
          }
        />
        <CardDivider />
        <Row
          icon="bug-outline"
          label="Reportar un problema"
          description="Cuéntanos qué falló y en qué pantalla"
          onPress={() =>
            showSoon(
              'Reportar un problema',
              'Pronto podrás mandar el reporte desde aquí con una captura automática de la pantalla.',
            )
          }
        />
        <CardDivider />
        <Row
          icon="bulb-outline"
          label="Sugerir una idea"
          description="¿Qué te gustaría que Foxy hiciera?"
          onPress={() =>
            showSoon('Tu idea cuenta', 'El buzón de ideas se abrirá en la próxima versión de Fox.')
          }
        />
      </Card>

      <SectionTitle>Aprender a usar Fox</SectionTitle>
      <Card>
        <Row
          icon="play-circle-outline"
          label="Recorrido rápido"
          description="Cómo preguntar, escanear y crear exámenes"
          onPress={() =>
            showSoon(
              'Recorrido rápido',
              'Toca el botón Comenzar en la pantalla principal: ahí están las cuatro cosas que Foxy puede hacer por ti.',
            )
          }
        />
        <CardDivider />
        <Row
          icon="shield-checkmark-outline"
          label="Privacidad y términos"
          description="Qué guardamos y qué no"
          onPress={() => router.push('/settings/privacy')}
        />
      </Card>

      <Note icon="heart-outline">
        Fox está hecho por un equipo pequeño. Si algo no funciona como esperabas, cuéntanoslo: nos
        ayuda muchísimo.
      </Note>
    </ScreenShell>
  );
}
