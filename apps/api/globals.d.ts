export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      HOST: string;
      PORT: string;
      AXIOS_BASE_URL: string;
      CORS_ORIGIN: string;
    }
  }
}
