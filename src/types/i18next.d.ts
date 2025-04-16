/**
 * Файл с объявлениями типов для переопределения проблемных типов i18next
 */
import 'i18next';

// Переопределение проблемных типов
declare module 'i18next' {
  // Полное переопределение TFunction, чтобы избежать проблем с оригинальными типами
  export interface TFunction {
    // Базовые сигнатуры для функции t
    (key: string | readonly string[], options?: any): string;
    (key: string | readonly string[], defaultValue: string, options?: any): string;
  }
  
  // Полное переопределение i18n без использования сложных дженериков
  export interface i18n {
    // Полное определение функции t
    t: TFunction;
    
    // Остальные методы
    changeLanguage(lng?: string): Promise<TFunction>;
    language: string;
    languages: readonly string[];
    isInitialized: boolean;
    use(plugin: any): i18n;
    format(value: any, format?: string, lng?: string): string;
    exists(key: string | readonly string[], options?: any): boolean;
    getFixedT(lng: string | readonly string[], ns?: string | readonly string[]): TFunction;
    loadNamespaces(ns: string | readonly string[], callback?: () => void): Promise<void>;
    loadLanguages(lngs: string | readonly string[], callback?: () => void): Promise<void>;
    
    // События
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    
    // Инициализация
    init(options: any, callback?: (err: any, t: TFunction) => void): Promise<TFunction>;
  }
  
  // Явное объявление статических свойств и методов
  export const t: TFunction;
  export const changeLanguage: (lng?: string) => Promise<TFunction>;
  export const language: string;
  export const languages: readonly string[];
  export const isInitialized: boolean;
  export function init(options: any, callback?: (err: any, t: TFunction) => void): Promise<TFunction>;
  export function use(plugin: any): typeof i18next;
  export function on(event: string, listener: (...args: any[]) => void): void;
  export function off(event: string, listener: (...args: any[]) => void): void;
} 