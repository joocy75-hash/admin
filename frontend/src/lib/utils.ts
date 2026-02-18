import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const amountFormatter = new Intl.NumberFormat('ko-KR');

export function formatAmount(amount: number): string {
  return '\u20A9' + amountFormatter.format(amount);
}
