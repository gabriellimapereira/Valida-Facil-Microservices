import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";
import * as profileService from "../services/profileService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Começa "true": o app precisa checar se já existe uma sessão JWT salva
  // antes de decidir se mostra o login ou não —
  // sem isso, recarregar a página sempre jogaria o usuário pra tela de
  // login mesmo estando logado.
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    if (authUser.company_id && authUser.role) {
      setProfile({
        id: authUser.id,
        company_id: authUser.company_id,
        role: authUser.role,
        full_name: authUser.full_name,
        store_id: authUser.store_id,
      });
      return;
    }
    try {
      const p = await profileService.fetchProfile(authUser.id);
      setProfile(p);
    } catch (err) {
      console.error("Falha ao carregar o perfil do usuário:", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const sessionUser = await authService.getSessionUser();
        if (!mounted) return;
        setUser(sessionUser);
        await loadProfile(sessionUser);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const subscription = authService.onAuthStateChange((sessionUser) => {
      setUser(sessionUser);
      loadProfile(sessionUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const loggedUser = await authService.login(email, password);
      setUser(loggedUser);
      await loadProfile(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    await loadProfile(user);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      companyId: profile?.company_id ?? null,
      storeId: profile?.store_id ?? null,
      role: profile?.role ?? null,
      isAuthenticated: Boolean(user),
      // true = usuário autenticado mas ainda sem empresa vinculada
      // (onboarding pendente — telas do Passo 2 vão resolver isso).
      needsOnboarding: Boolean(user) && !profile?.company_id,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      companyId: null,
      storeId: null,
      role: null,
      isAuthenticated: false,
      needsOnboarding: false,
      loading: false,
      signIn: async () => {},
      signOut: async () => {},
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
