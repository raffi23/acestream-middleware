import { create } from "zustand";
type Store = {
  access_token: string;
  setAccessToken: (token: string) => void;
};

export const useStore = create<Store>((set) => ({
  access_token: "",
  setAccessToken: (access_token: string) => set({ access_token }),
}));
