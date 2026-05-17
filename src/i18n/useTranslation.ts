"use client";

import { useCallback, useMemo } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import type { MessageId } from "@/i18n/messages";
import { translate, type UiLocale } from "@/i18n/messages";

export function useTranslation() {
  const { settings, updateAppearance } = useSettings();
  const locale = settings.appearance.locale;

  const t = useCallback((id: MessageId) => translate(locale, id), [locale]);

  const setLocale = useCallback(
    (next: UiLocale) => {
      updateAppearance({ locale: next });
    },
    [updateAppearance],
  );

  return useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale]);
}
