import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveTargetLang } from "../lib/languages";
import type { ProviderType, TranslationResponse } from "../types";

interface UseTranslationOptions {
  sourceLang: string;
  targetLang: string;
  provider: ProviderType;
  nativeLang: string;
  secondLang: string;
}

function errorToString(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Неизвестная ошибка перевода";
}

export function useTranslation(options: UseTranslationOptions) {
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [targetLangUsed, setTargetLangUsed] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const translate = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    const requestId = ++requestIdRef.current;

    if (!text) {
      setResult(null);
      setError(null);
      setIsLoading(false);
      setTargetLangUsed(null);
      return;
    }

    const { sourceLang, targetLang, provider, nativeLang, secondLang } =
      optionsRef.current;
    const effectiveTarget = resolveTargetLang(
      text,
      targetLang,
      nativeLang,
      secondLang,
    );

    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<TranslationResponse>("translate_text", {
        text,
        sourceLang,
        targetLang: effectiveTarget,
        provider,
      });

      if (requestId === requestIdRef.current) {
        setResult(response);
        setTargetLangUsed(effectiveTarget);
      }
    } catch (translationError) {
      if (requestId === requestIdRef.current) {
        setError(errorToString(translationError));
        setResult(null);
        setTargetLangUsed(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setIsLoading(false);
    setTargetLangUsed(null);
  }, []);

  return { result, error, isLoading, targetLangUsed, translate, clear };
}
