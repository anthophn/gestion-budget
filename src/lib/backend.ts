import { cloudConfigured, createCloudAuth } from './cloud';
import { createLocalAuth } from './local';
import type { AuthService } from './types';

/** Supabase si l'appli a été compilée avec ses clés, sinon le mode local (démo, sans synchronisation). */
export const auth: AuthService = cloudConfigured ? createCloudAuth() : createLocalAuth();

export const isNativeApp = location.protocol === 'file:' || 'Capacitor' in window || import.meta.env.MODE === 'native';
