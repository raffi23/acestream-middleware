export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_BE_URL: string;
      NEXT_PUBLIC_HOST_URL: string;
    }
  }
}
