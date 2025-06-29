export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_BE_URL: string;
      NEXT_PUBLIC_ACCESS_TOKEN: string;
      NEXT_PUBLIC_ACCESS_TOKEN_ID: string;
      NEXT_PUBLIC_ACCESS_TOKEN_COMBINED: string;
    }
  }
}
