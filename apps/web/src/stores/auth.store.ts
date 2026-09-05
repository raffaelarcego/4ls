import { create } from 'zustand';
import { getToken, setToken } from '../services/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  signIn: (token, user) => {
    setToken(token);
    set({ token, user });
  },
  signOut: () => {
    setToken(null);
    set({ token: null, user: null });
  },
  setUser: (user) => set({ user }),
}));
