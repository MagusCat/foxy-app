import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

import { PortalHost, SheetSlide } from './portal';

export type DialogAction = {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onPress?: () => void;
};

export type DialogRequest = {
  title: string;
  message?: string;
  actions?: DialogAction[];
};

export type SheetRequest = {
  title?: string;
  render: (close: () => void) => ReactNode;
};

export type PromptRequest = {
  title: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  maxLength?: number;
  onSubmit: (value: string) => void;
};

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type OverlayContextValue = {
  showDialog: (request: DialogRequest) => void;
  showSheet: (request: SheetRequest) => void;
  showPrompt: (request: PromptRequest) => void;
  closeSheet: () => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay debe usarse dentro de OverlayProvider');
  return ctx;
}

let activeOverlay: OverlayContextValue | null = null;

export function reportToUser(request: DialogRequest) {
  activeOverlay?.showDialog(request);
}

export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' } as AlertButton];
  const sorted = [...list].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));

  reportToUser({
    title,
    message,
    actions: sorted.map((button) => ({
      label: button.text,
      danger: button.style === 'destructive',
      primary: button.style !== 'cancel' && button.style !== 'destructive',
      onPress: button.onPress,
    })),
  });
}

function PromptSheetContent({
  description,
  placeholder,
  initialValue,
  confirmLabel,
  maxLength,
  onSubmit,
  close,
}: PromptRequest & { close: () => void }) {
  const [draft, setDraft] = useState(initialValue ?? '');
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0;

  const submit = () => {
    if (!canSave) return;
    close();
    onSubmit(trimmed);
  };

  return (
    <>
      {description ? (
        <Text className="mb-3.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
          {description}
        </Text>
      ) : null}

      <TextInput
        className="mb-[18px] rounded-[14px] border border-card-light-border bg-surface-light px-3.5 py-2.5 text-sm text-text-primary-light dark:border-card-dark-border dark:bg-surface-dark dark:text-text-primary-dark"
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        value={draft}
        onChangeText={setDraft}
        maxLength={maxLength}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      <TouchableOpacity
        className="items-center rounded-2xl bg-primary px-5 py-3"
        style={canSave ? undefined : { opacity: 0.5 }}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel ?? 'Guardar'}
        onPress={submit}
      >
        <Text className="text-sm font-semibold text-white">{confirmLabel ?? 'Guardar'}</Text>
      </TouchableOpacity>
    </>
  );
}

function SheetHost({ sheet, onClose }: { sheet: SheetRequest | null; onClose: () => void }) {
  const { colors } = useTheme();
  const paddingBottom = useSheetPaddingBottom();

  if (!sheet) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[StyleSheet.absoluteFill, { zIndex: 950, elevation: 950 }]}
    >
      <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
        />

        <SheetSlide>
          <View
            className="max-h-[88%] rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom }}
          >
          {sheet.title ? (
            <Text className="mb-4 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {sheet.title}
            </Text>
          ) : null}
          {sheet.render(onClose)}
          </View>
        </SheetSlide>
      </View>
    </Animated.View>
  );
}

function DialogHost({ dialog, onClose }: { dialog: DialogRequest | null; onClose: () => void }) {
  const { colors } = useTheme();

  if (!dialog) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
    >
      <View className="flex-1 items-center justify-center bg-black/55 px-6 dark:bg-black/80">
        <View
          className="w-full rounded-[22px] border border-card-light-border bg-card-light p-5 dark:border-card-dark-border dark:bg-card-dark"
          style={{ elevation: 10 }}
        >
          <Text className="mb-1 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            {dialog.title}
          </Text>
          {dialog.message ? (
            <Text className="mb-4 text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
              {dialog.message}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          <View className="gap-2">
            {dialog.actions!.map((action, index) => (
              <TouchableOpacity
                key={`${action.label}-${index}`}
                className="items-center rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: action.primary
                    ? action.danger
                      ? '#EF4444'
                      : Palette.primary
                    : colors.surface,
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: action.primary ? '#FFFFFF' : action.danger ? '#EF4444' : colors.text,
                  }}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const showDialog = useCallback((request: DialogRequest) => {
    setDialog(
      request.actions && request.actions.length > 0
        ? request
        : { ...request, actions: [{ label: 'Entendido', primary: true }] },
    );
  }, []);

  const showSheet = useCallback((request: SheetRequest) => setSheet(request), []);

  const showPrompt = useCallback((request: PromptRequest) => {
    setSheet({
      title: request.title,
      render: (close) => <PromptSheetContent {...request} close={close} />,
    });
  }, []);

  const value = useMemo<OverlayContextValue>(
    () => ({ showDialog, showSheet, showPrompt, closeSheet }),
    [showDialog, showSheet, showPrompt, closeSheet],
  );

  useEffect(() => {
    activeOverlay = value;
    return () => {
      if (activeOverlay === value) activeOverlay = null;
    };
  }, [value]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dialog) {
        closeDialog();
        return true;
      }
      if (sheet) {
        closeSheet();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [dialog, sheet, closeDialog, closeSheet]);

  return (
    <OverlayContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <PortalHost />
        <SheetHost sheet={sheet} onClose={closeSheet} />
        <DialogHost dialog={dialog} onClose={closeDialog} />
      </View>
    </OverlayContext.Provider>
  );
}
