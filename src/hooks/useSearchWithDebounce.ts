import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSearchWithDebounceOptions {
  /** Debounce delay in ms (default 300) */
  delay?: number;
  /** Minimum query length to trigger search (default 2) */
  minLength?: number;
}

interface UseSearchWithDebounceReturn<T> {
  query: string;
  setQuery: (q: string) => void;
  debouncedQuery: string;
  results: T[];
  setResults: (r: T[]) => void;
  isSearching: boolean;
  setIsSearching: (s: boolean) => void;
  clearSearch: () => void;
}

export function useSearchWithDebounce<T = any>(
  options: UseSearchWithDebounceOptions = {}
): UseSearchWithDebounceReturn<T> {
  const { delay = 300, minLength = 2 } = options;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.length < minLength) {
      setDebouncedQuery('');
      return;
    }

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, delay, minLength]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setIsSearching(false);
  }, []);

  return { query, setQuery, debouncedQuery, results, setResults, isSearching, setIsSearching, clearSearch };
}
