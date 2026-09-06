import React, { useEffect, useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { useScreenPadding } from '@/components/screen-header';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { AppModal } from '@/features/shared/components/portal';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

export function softTint(color: string, isDark: boolean) {
  return `${color}${isDark ? '2E' : '1F'}`;
}

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ScreenShell({ title, subtitle, children }: ScreenShellProps) {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const { colors } = useTheme();
  const keyboardHeight = useKeyboardHeight();

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <View className="flex-row items-center px-5 pb-4" style={{ paddingTop: padding.top }}>
        <TouchableOpacity
          className="mr-3 h-9 w-9 items-center justify-center rounded-full border"
          style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        <View className="flex-1">
          <Text
            className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: padding.stackBottom + keyboardHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
      {children}
    </Text>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { colors } = useTheme();
  return (
    <View
      className={`overflow-hidden rounded-2xl border ${className}`}
      style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
    >
      {children}
    </View>
  );
}

export function CardDivider() {
  const { colors } = useTheme();
  return <View className="ml-[58px] h-px" style={{ backgroundColor: colors.cardBorder }} />;
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  label: string;
  description?: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
};

export function Row({
  icon,
  color,
  label,
  description,
  value,
  badge,
  danger,
  onPress,
  right,
}: RowProps) {
  const { colors, isDark } = useTheme();
  const accent = danger ? '#EF4444' : color;
  const iconColor = accent ?? colors.icon;

  const content = (
    <View className="flex-row items-center px-3.5 py-3.5">
      <View
        className="mr-3 h-8 w-8 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: accent ? softTint(accent, isDark) : colors.surface }}
      >
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center">
          <Text
            className="text-[15px] font-medium text-text-primary-light dark:text-text-primary-dark"
            style={danger ? { color: '#EF4444' } : undefined}
            numberOfLines={1}
          >
            {label}
          </Text>
          {badge ? (
            <View
              className="ml-2 rounded-full px-2 py-0.5"
              style={{ backgroundColor: softTint(iconColor, isDark) }}
            >
              <Text className="text-[10px] font-bold" style={{ color: iconColor }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

        {description ? (
          <Text className="mt-0.5 text-[12px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
            {description}
          </Text>
        ) : null}
      </View>

      {right ?? (
        <View className="ml-2 flex-row items-center">
          {value ? (
            <Text
              className="mr-1.5 max-w-[110px] text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.icon} /> : null}
        </View>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

type SwitchRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

export function SwitchRow({
  icon,
  color,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: SwitchRowProps) {
  const { isDark } = useTheme();

  return (
    <View style={disabled ? { opacity: 0.5 } : undefined}>
      <Row
        icon={icon}
        color={color}
        label={label}
        description={description}
        right={
          <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: isDark ? '#2D2D3A' : '#D1D5DB', true: Palette.primary }}
            thumbColor="#FFFFFF"
          />
        }
      />
    </View>
  );
}

type ChipGroupProps<T extends string> = {
  options: { value: T; label: string; hint?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  accent?: string;
};

export function ChipGroup<T extends string>({ options, selected, onSelect, accent }: ChipGroupProps<T>) {
  const { isDark, colors } = useTheme();
  const color = accent ?? (isDark ? Palette.primaryGlow : Palette.primary);

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.value)}
            className="rounded-2xl border-[1.5px] px-3.5 py-2"
            style={{
              borderColor: isSelected ? color : colors.cardBorder,
              backgroundColor: isSelected ? softTint(color, isDark) : colors.card,
            }}
          >
            <Text
              className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
              style={isSelected ? { color, fontWeight: '700' } : undefined}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text className="mt-0.5 text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

type PromptModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  initialValue: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  allowEmpty?: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
};

export function PromptModal({
  visible,
  title,
  description,
  placeholder,
  initialValue,
  keyboardType,
  maxLength = 60,
  allowEmpty = false,
  onCancel,
  onSave,
}: PromptModalProps) {
  const keyboardHeight = useKeyboardHeight();
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    if (visible) setDraft(initialValue);
  }, [visible, initialValue]);

  const trimmed = draft.trim();
  const canSave = allowEmpty || trimmed.length > 0;

  return (
    <AppModal visible={visible} onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center bg-black/55 px-6 dark:bg-black/80"
        style={{ paddingBottom: keyboardHeight }}
      >
        <View
          className="w-full rounded-[22px] border border-[#E5E7EB] bg-white p-5 dark:border-[#342F42] dark:bg-[#1C1924]"
          style={{ elevation: 10 }}
        >
          <Text className="mb-1 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            {title}
          </Text>
          {description ? (
            <Text className="mb-3.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
              {description}
            </Text>
          ) : (
            <View className="mb-3.5" />
          )}

          <TextInput
            className="mb-[18px] rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
            placeholder={placeholder}
            placeholderTextColor="#6B7280"
            value={draft}
            onChangeText={setDraft}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canSave && onSave(trimmed)}
          />

          <View className="flex-row justify-end gap-2.5">
            <TouchableOpacity className="rounded-2xl px-4 py-2" onPress={onCancel}>
              <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-2xl bg-primary px-5 py-2"
              style={canSave ? undefined : { opacity: 0.5 }}
              disabled={!canSave}
              onPress={() => onSave(trimmed)}
            >
              <Text className="text-sm font-semibold text-white">Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

export function Note({ icon = 'information-circle-outline', children }: {
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View className="mt-2.5 flex-row items-start px-1">
      <Ionicons name={icon} size={13} color={colors.icon} style={{ marginTop: 1.5, marginRight: 6 }} />
      <Text className="flex-1 text-[11px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
        {children}
      </Text>
    </View>
  );
}
