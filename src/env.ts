const envValue = (name: string): string | undefined => {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
};

export const getEnv = (keys: string[], fallback = ''): string => {
  for (const key of keys) {
    const value = envValue(key);
    if (value) return value;
  }
  return fallback;
};