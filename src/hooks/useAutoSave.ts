import { useEffect, useRef } from "react";

export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => void,
  delay = 2000
) {
  const savedCallback = useRef(onSave);
  savedCallback.current = onSave;

  useEffect(() => {
    const timer = setTimeout(() => {
      savedCallback.current(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
}
