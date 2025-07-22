export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PANGOLIN_TOKEN: string;
      BACKEND_URL: string;
      NEXT_PUBLIC_BACKEND_URL: string;
    }
  }
}
