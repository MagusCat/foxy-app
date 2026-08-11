import React from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BrandLogo } from '@/components/brand-logo';
import { useScreenPadding } from '@/components/screen-header';
import { Palette } from '@/constants/theme';
import { type AuthProvider, useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

type ProviderButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** El botón destacado de la pantalla: relleno rojo y texto blanco. */
  primary?: boolean;
  onPress: () => void;
};

function ProviderButton({ icon, label, primary, onPress }: ProviderButtonProps) {
  const { colors } = useTheme();
  const foreground = primary ? '#FFFFFF' : colors.text;

  return (
    <TouchableOpacity
      className="mb-3 flex-row items-center justify-center rounded-full border py-4"
      style={{
        backgroundColor: primary ? Palette.primary : colors.card,
        borderColor: primary ? Palette.primary : colors.cardBorder,
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={foreground} style={{ marginRight: 10 }} />
      <Text className="text-[13px] font-bold uppercase tracking-wider" style={{ color: foreground }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Enlace legal. Los documentos todavía no están publicados. */
function LegalLink({ label }: { label: string }) {
  return (
    <Text
      className="font-semibold"
      style={{ color: Palette.primary }}
      onPress={() =>
        Alert.alert(
          label,
          'Este documento se publicará antes de abrir las cuentas. Mientras tanto, todo lo que escribes se queda en este dispositivo.',
        )
      }
    >
      {label}
    </Text>
  );
}

export default function LoginScreen() {
  const padding = useScreenPadding();
  const { colors } = useTheme();
  const { signIn } = useAuth();

  /**
   * TODO(auth): aquí va el flujo real de cada proveedor (expo-auth-session
   * para Google, expo-apple-authentication para Apple y una pantalla propia
   * para el correo). Por ahora solo se abre la sesión local: el gate del
   * layout raíz ve `isSignedIn` y manda a las pestañas.
   */
  const handleSignIn = (provider: AuthProvider) => {
    signIn(provider);
  };

  return (
    <View
      className="flex-1 bg-bg-light px-8 dark:bg-bg-dark"
      style={{ paddingTop: padding.top, paddingBottom: padding.stackBottom }}
    >
      {/* HUECO DEL LOGO: ocupa la mitad superior, como en el diseño. */}
      <View className="flex-1 items-center justify-center">
        <BrandLogo size={64} withWordmark />
      </View>

      <View>
        <Text className="text-center text-[26px] font-bold text-text-primary-light dark:text-text-primary-dark">
          Iniciar sesión
        </Text>
        <Text className="mb-8 mt-2 text-center text-[14px] leading-[20px] text-text-secondary-light dark:text-text-secondary-dark">
          Entra a tu cuenta o crea una nueva. Es gratis.
        </Text>

        <ProviderButton
          icon="logo-google"
          label="Continuar con Google"
          onPress={() => handleSignIn('google')}
        />

        {/* Apple solo tiene sentido en iOS: en Android no hay a quién pedirle
            la identidad. */}
        {Platform.OS === 'ios' ? (
          <ProviderButton
            icon="logo-apple"
            label="Continuar con Apple"
            onPress={() => handleSignIn('apple')}
          />
        ) : null}

        <ProviderButton
          icon="mail-outline"
          label="Continuar con correo"
          primary
          onPress={() => handleSignIn('email')}
        />

        <Text className="mt-5 text-center text-[11px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
          Al continuar aceptas los <LegalLink label="Términos de uso" /> y la{' '}
          <LegalLink label="Política de privacidad" />.
        </Text>

        <View
          className="mt-6 flex-row items-start rounded-2xl border p-3.5"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={colors.icon}
            style={{ marginTop: 1, marginRight: 8 }}
          />
          <Text className="flex-1 text-[11px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
            Las cuentas en línea aún no están conectadas. Por ahora cualquier opción abre la app y
            tus datos se guardan solo en este dispositivo.
          </Text>
        </View>
      </View>
    </View>
  );
}
