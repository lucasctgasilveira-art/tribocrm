import { http } from './http';
import { storage } from '@shared/utils/storage';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('auth-service');

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse['user']> {
    const data = await http.post<LoginResponse>(
      '/auth/login',
      { email, password },
      { skipAuth: true }
    );

    await storage.set('auth', {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      user: data.user
    });

    log.info('Login bem-sucedido', data.user.email);
    return data.user;
  },

  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout');
    } catch (err) {
      // Ignora erro — vamos limpar localmente de qualquer jeito
      log.warn('Logout remoto falhou', err);
    }
    await storage.set('auth', null);
  },

  async getCurrentUser(): Promise<LoginResponse['user'] | null> {
    const auth = await storage.get('auth');
    return auth?.user ?? null;
  },

  async isAuthenticated(): Promise<boolean> {
    const auth = await storage.get('auth');
    if (!auth) return false;
    // Se já expirou, ainda consideramos autenticado — o refresh vai tentar renovar
    return true;
  }
};
