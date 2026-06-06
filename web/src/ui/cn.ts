import { clsx, type ClassValue } from 'clsx';

// Single class-merge helper for the design system. Keep it tiny — no tailwind-merge
// dependency; author classes so they don't conflict (the variant maps below do).
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
