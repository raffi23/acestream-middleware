export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PANGOLIN_TOKEN: string;
      NEXT_PUBLIC_BE_URL: string;
    }
  }
}
