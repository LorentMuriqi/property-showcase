import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type AdminRole = {
  id: number;
  name: string;
  description: string | null;
  can_create_property: boolean;
  can_edit_property: boolean;
  can_delete_property: boolean;
  can_manage_virtual_tours: boolean;
};

type AdminUserProfile = {
  user_id: string;
  username: string;
  full_name: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  role_id: number | null;
  admin_roles: AdminRole | null;
};

type Permissions = {
  canCreateProperty: boolean;
  canEditProperty: boolean;
  canDeleteProperty: boolean;
  canManageVirtualTours: boolean;
};

interface AuthContextType {
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userProfile: AdminUserProfile | null;
  permissions: Permissions;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultPermissions: Permissions = {
  canCreateProperty: false,
  canEditProperty: false,
  canDeleteProperty: false,
  canManageVirtualTours: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<AdminUserProfile | null>(null);

  const loadProfile = async () => {
    setIsLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Get session error:", sessionError);
        setUserProfile(null);
        return;
      }

      const user = session?.user;

      if (!user) {
        setUserProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select(
          `
          user_id,
          username,
          full_name,
          is_super_admin,
          is_active,
          role_id,
          admin_roles (
            id,
            name,
            description,
            can_create_property,
            can_edit_property,
            can_delete_property,
            can_manage_virtual_tours
          )
        `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Load admin profile error:", error);
        setUserProfile(null);
        return;
      }

      if (!data || !data.is_active) {
        setUserProfile(null);
        return;
      }

      setUserProfile(data as AdminUserProfile);
    } catch (error) {
      console.error("Auth loadProfile unexpected error:", error);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshAuth = async () => {
    await loadProfile();
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUserProfile(null);
    }
  };

  const value = useMemo<AuthContextType>(() => {
    const isSuperAdmin = !!userProfile?.is_super_admin;
    const role = userProfile?.admin_roles ?? null;

    const permissions: Permissions = {
      canCreateProperty: isSuperAdmin || !!role?.can_create_property,
      canEditProperty: isSuperAdmin || !!role?.can_edit_property,
      canDeleteProperty: isSuperAdmin || !!role?.can_delete_property,
      canManageVirtualTours: isSuperAdmin || !!role?.can_manage_virtual_tours,
    };

    return {
      isLoading,
      isAdmin: !!userProfile,
      isSuperAdmin,
      userProfile,
      permissions,
      refreshAuth,
      logout,
    };
  }, [isLoading, userProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}