import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

type MathKey = {
  /** Lo que se ve en la tecla. */
  label: string;
  /** Lo que se escribe. Si falta, se escribe la etiqueta tal cual. */
  insert?: string;
};

type MathCategory = {
  id: string;
  title: string;
  keys: MathKey[];
};

/** Teclas por fila. Todas las categorías traen un múltiplo de este número. */
const COLUMNS = 5;

/**
 * Parte la lista en filas fijas.
 *
 * Antes la rejilla era `flex-wrap` con anchos en porcentaje más `gap`: en
 * pantallas angostas la suma pasaba del ancho disponible, entraban cuatro
 * teclas por fila en vez de cinco y el teclado se veía desalineado. Con filas
 * explícitas y teclas `flex-1` el ancho lo reparte flexbox y siempre cuadra.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

/**
 * El teclado escribe al final del mensaje, como cualquier calculadora: se
 * construye la expresión de izquierda a derecha y `⌫` borra el último
 * carácter. Controlar el cursor del TextInput desde aquí provoca saltos en
 * Android, y la hoja tapa el input de todos modos.
 */
const CATEGORIES: MathCategory[] = [
  {
    id: 'basico',
    title: 'Básico',
    keys: [
      { label: '7' }, { label: '8' }, { label: '9' }, { label: '÷', insert: '/' }, { label: '(' },
      { label: '4' }, { label: '5' }, { label: '6' }, { label: '×', insert: '*' }, { label: ')' },
      { label: '1' }, { label: '2' }, { label: '3' }, { label: '−', insert: '-' }, { label: '=' },
      { label: '0' }, { label: '.' }, { label: ',' }, { label: '+' }, { label: '%' },
      { label: '≠' }, { label: '≈' }, { label: '<' }, { label: '>' }, { label: '≤' },
      { label: '≥' }, { label: '±' }, { label: '·' }, { label: '[' }, { label: ']' },
    ],
  },
  {
    id: 'algebra',
    title: 'Álgebra',
    keys: [
      // Incógnitas y constantes
      { label: 'x' }, { label: 'y' }, { label: 'z' }, { label: 'n' }, { label: 'π' },
      // Potencias y raíces
      { label: 'x²', insert: '^2' }, { label: 'x³', insert: '^3' }, { label: 'xⁿ', insert: '^' },
      { label: '√', insert: '√(' }, { label: '∛', insert: '∛(' },
      // Agrupación
      { label: '(' }, { label: ')' }, { label: 'a/b', insert: '/' }, { label: '|x|', insert: '||' }, { label: 'e' },
      // Funciones
      { label: 'log', insert: 'log(' }, { label: 'ln', insert: 'ln(' }, { label: 'f(x)' },
      { label: 'n!', insert: '!' }, { label: '∞' },
    ],
  },
  {
    id: 'calculo',
    title: 'Cálculo',
    keys: [
      // Integrales
      { label: '∫' }, { label: '∬' }, { label: '∮' }, { label: '∂' }, { label: '∇' },
      // Sumatorias y límites
      { label: '∑' }, { label: '∏' }, { label: 'lím' }, { label: '→' }, { label: 'dx' },
      // Derivadas
      { label: 'd/dx' }, { label: "f′", insert: '′' }, { label: 'f″', insert: '″' }, { label: 'Δ' }, { label: 'θ' },
      // Trigonometría
      { label: 'sen', insert: 'sen(' }, { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' },
      { label: '°' }, { label: '∞' },
    ],
  },
  {
    id: 'conjuntos',
    title: 'Conjuntos y lógica',
    keys: [
      { label: '∈' }, { label: '∉' }, { label: '⊂' }, { label: '⊆' }, { label: '∅' },
      { label: '∪' }, { label: '∩' }, { label: '∀' }, { label: '∃' }, { label: '¬' },
      { label: '∧' }, { label: '∨' }, { label: '⇒' }, { label: '⇔' }, { label: '∴' },
      { label: 'ℕ' }, { label: 'ℤ' }, { label: 'ℚ' }, { label: 'ℝ' }, { label: 'ℂ' },
    ],
  },
  {
    id: 'geometria',
    title: 'Geometría',
    keys: [
      { label: '∠' }, { label: '°' }, { label: '⊥' }, { label: '∥' }, { label: '△' },
      { label: '≅' }, { label: '∼' }, { label: '□' }, { label: '○' }, { label: 'π' },
      { label: 'α' }, { label: 'β' }, { label: 'γ' }, { label: 'δ' }, { label: 'θ' },
      { label: 'λ' }, { label: 'μ' }, { label: 'σ' }, { label: 'φ' }, { label: 'ω' },
    ],
  },
];

type MathKeyboardProps = {
  visible: boolean;
  onClose: () => void;
  /** Texto actual del mensaje: se muestra en la vista previa. */
  value: string;
  /**
   * Recibe una transformación, no el texto ya calculado: React agrupa las
   * actualizaciones y con teclas pulsadas rápido el valor del render anterior
   * llega viejo, así que los símbolos se pisaban entre sí.
   */
  onEdit: (updater: (previous: string) => string) => void;
};

export function MathKeyboard({ visible, onClose, value, onEdit }: MathKeyboardProps) {
  const { isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);

  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;
  const accent = isDark ? Palette.accentBlueGlow : Palette.accentBlue;
  const category = CATEGORIES.find((item) => item.id === categoryId) ?? CATEGORIES[0];

  const press = (key: MathKey) => onEdit((previous) => previous + (key.insert ?? key.label));
  const backspace = () => onEdit((previous) => previous.slice(0, -1));
  const space = () => onEdit((previous) => `${previous} `);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />

        <View
          className="max-h-[86%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
          style={{ paddingBottom: sheetPaddingBottom }}
        >
          {/* Encabezado */}
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="calculator" size={18} color={accent} />
              <Text className="ml-2 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Teclado matemático
              </Text>
            </View>
            <TouchableOpacity
              className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
              accessibilityRole="button"
              accessibilityLabel="Cerrar teclado matemático"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={iconOnSurface} />
            </TouchableOpacity>
          </View>

          {/* Vista previa de lo que se está escribiendo */}
          <View className="mb-3 min-h-[52px] justify-center rounded-[14px] border border-card-light-border bg-surface-light px-3.5 py-2.5 dark:border-surface-dark-border dark:bg-[#14121A]">
            {value.length > 0 ? (
              <Text
                className="text-base text-text-primary-light dark:text-text-primary-dark"
                numberOfLines={3}
              >
                {value}
                <Text style={{ color: accent }}>|</Text>
              </Text>
            ) : (
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Escribe tu ecuación con los símbolos de abajo…
              </Text>
            )}
          </View>

          {/* Categorías */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1 mb-3 max-h-11 grow-0"
            contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
          >
            {CATEGORIES.map((item) => {
              const isSelected = item.id === category.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  className="h-9 justify-center rounded-full border border-card-light-border bg-white px-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                  style={isSelected ? { borderColor: accent, backgroundColor: isDark ? '#152238' : '#DBEAFE' } : undefined}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setCategoryId(item.id)}
                >
                  <Text
                    className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                    style={isSelected ? { color: accent } : undefined}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Rejilla de símbolos */}
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {chunk(category.keys, COLUMNS).map((row, rowIndex) => (
              <View key={`${category.id}-${rowIndex}`} className="mb-2 flex-row gap-2">
                {row.map((key, index) => (
                  <TouchableOpacity
                    key={`${key.label}-${index}`}
                    className="h-[48px] flex-1 items-center justify-center rounded-[12px] border border-card-light-border bg-white dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`Insertar ${key.label}`}
                    onPress={() => press(key)}
                  >
                    <Text
                      // Las etiquetas largas ("log", "d/dx") bajan de tamaño
                      // para no partirse ni desbordar la tecla.
                      style={{ fontSize: key.label.length > 2 ? 13 : 18 }}
                      className="font-semibold text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={1}
                    >
                      {key.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Relleno: mantiene el ancho de las teclas en filas incompletas. */}
                {Array.from({ length: COLUMNS - row.length }).map((_, index) => (
                  <View key={`hueco-${index}`} className="flex-1" />
                ))}
              </View>
            ))}
          </ScrollView>

          {/* Acciones fijas */}
          <View className="mt-3 flex-row items-center gap-2 border-t border-card-light-border pt-3 dark:border-[#2A2533]">
            <TouchableOpacity
              className="h-11 flex-1 flex-row items-center justify-center rounded-[14px] border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Espacio"
              onPress={space}
            >
              <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                Espacio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="h-11 w-[70px] items-center justify-center rounded-[14px] border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Borrar el último símbolo"
              onPress={backspace}
              onLongPress={() => onEdit(() => '')}
            >
              <Ionicons name="backspace-outline" size={20} color={iconOnSurface} />
            </TouchableOpacity>

            <TouchableOpacity
              className="h-11 flex-1 items-center justify-center rounded-[14px] bg-primary"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Listo"
              onPress={onClose}
            >
              <Text className="text-[13px] font-bold text-white">Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
