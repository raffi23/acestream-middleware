export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      HOST: string;
      PORT: string;
      ACE_URL: string;
      CORS_ORIGIN: string;
    }
  }
}
