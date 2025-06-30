export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_BE_URL: string;
    }
  }
}
