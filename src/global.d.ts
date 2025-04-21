/// <reference types="@solidjs/start/env" />
/// <reference types="vinxi/client" />

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Поддержка .module.scss
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Объявление i18next
declare module 'i18next' {
  export default {
    t: (key: string | string[], options?: any) => string,
    use: (plugin: any) => any,
    init: (options: any) => Promise<any>,
    language: string,
    changeLanguage: (lng: string) => Promise<any>,
    isInitialized: boolean
  };

  export interface TFunction {
    (key: string | string[], options?: any): string;
  }

  export interface i18n {
    t: TFunction;
    language: string;
    changeLanguage: (lng: string) => Promise<any>;
  }
}

// Поддержка import.meta.env
interface ImportMeta {
  env: {
    NODE_ENV: string;
    MODE: string;
    PROD: boolean;
    DEV: boolean;
    PUBLIC_CDN_URL: string;
    PUBLIC_CORE_API: string;
    PUBLIC_CHAT_API: string;
    PUBLIC_AUTH_API: string;
    PUBLIC_REALTIME_EVENTS: string;
    PUBLIC_GA_IDENTITY: string;
    PUBLIC_AUTHORIZER_CLIENT_ID: string;
    PUBLIC_AUTHORIZER_REDIRECT_URL: string;
    PUBLIC_GLITCHTIP_DSN: string;
    [key: string]: any;
  };
}

// Объявление типа Shout с добавлением отсутствующего поля description
declare module '~/types/shout' {
  interface Shout {
    description?: string;
    // ... другие поля
  }
}
