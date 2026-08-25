import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminRole = {
  id: number;
  name: string;
  description: string | null;
};

type AdminUser = {
  user_id: string;
  username: string;
  full_name: string | null;
  role_id: number | null;
  role: AdminRole | null;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  password_changed_at: string | null;
  auth_email: string | null;
  auth_banned_until: string | null;
  last_sign_in_at: string | null;
};

type ListResponse = {
  users: AdminUser[];
  roles: AdminRole[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
};

type ModalType =
  | "create"
  | "edit"
  | "password"
  | "deactivate"
  | "reactivate"
  | "delete"
  | null;

type StatusFilter = "all" | "active" | "inactive";

type UserFormState = {
  username: string;
  fullName: string;
  roleId: string;
};

type PasswordFormState = {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
};

const PAGE_SIZE = 10;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;
const PASSWORD_MIN_LENGTH = 12;

const emptyUserForm: UserFormState = {
  username: "",
  fullName: "",
  roleId: "",
};

const emptyPasswordForm: PasswordFormState = {
  password: "",
  confirmPassword: "",
  showPassword: false,
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function formatDateTime(value: string | null, emptyLabel = "Asnjëherë") {
  if (!value) return emptyLabel;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(user: AdminUser) {
  const source = user.full_name?.trim() || user.username;
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function isFutureDate(value: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function hasStatusMismatch(user: AdminUser) {
  const isAuthBanned = isFutureDate(user.auth_banned_until);
  return user.is_active ? isAuthBanned : !isAuthBanned;
}

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= PASSWORD_MIN_LENGTH,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const score = checks.filter(Boolean).length;
  const labels = ["Shumë i dobët", "I dobët", "Mesatar", "I mirë", "I fortë"];

  return {
    score,
    label: labels[score],
  };
}

function secureRandomIndex(max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function generateSecurePassword(length = 18) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*_-+=",
  ];
  const all = groups.join("");

  const characters = groups.map((group) => group[secureRandomIndex(group.length)]);

  while (characters.length < length) {
    characters.push(all[secureRandomIndex(all.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

async function extractFunctionError(error: unknown) {
  let message = error instanceof Error ? error.message : "Kërkesa dështoi.";

  const candidate = error as {
    context?: unknown;
  };

  if (
    typeof Response !== "undefined" &&
    candidate?.context instanceof Response
  ) {
    try {
      const payload = (await candidate.context.clone().json()) as ApiEnvelope<unknown>;
      if (payload.message) message = payload.message;
    } catch {
      // Keep the original SDK error if the response body is not JSON.
    }
  }

  return message;
}

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body,
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }

  const envelope = data as ApiEnvelope<T> | null;

  if (!envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message || "Serveri nuk ktheu një përgjigje të vlefshme.");
  }

  return envelope.data;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  description: string;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          : "border-red-500/20 bg-red-500/10 text-red-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-red-400"
        }`}
      />
      {active ? "Aktiv" : "Joaktiv"}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  closeDisabled,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  closeDisabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-border bg-background shadow-2xl sm:max-w-xl sm:rounded-[28px]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 px-5 py-5 backdrop-blur-xl sm:px-7">
          <div>
            <h2
              id="admin-user-modal-title"
              className="font-display text-2xl font-bold text-foreground"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Mbyll"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </label>
  );
}

export default function AdminUsers() {
  const {
    isAdmin,
    isSuperAdmin,
    isLoading: authLoading,
    userProfile,
  } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(emptyPasswordForm);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

    if (!isSuperAdmin) {
      setLocation("/admin");
    }
  }, [authLoading, isAdmin, isSuperAdmin, setLocation]);

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const payload = await invokeAdminUsers<ListResponse>({ action: "list" });
        setUsers(payload.users);
        setRoles(payload.roles);
      } catch (error) {
        toast({
          title: "Nuk u ngarkuan përdoruesit",
          description:
            error instanceof Error ? error.message : "Provo përsëri.",
          variant: "destructive",
        });

        if (!silent) {
          setUsers([]);
          setRoles([]);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!authLoading && isAdmin && isSuperAdmin) {
      void fetchData();
    }
  }, [authLoading, fetchData, isAdmin, isSuperAdmin]);

  useEffect(() => {
    if (!modalType) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        setModalType(null);
        setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSubmitting, modalType]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter]);

  const stats = useMemo(() => {
    const active = users.filter((user) => user.is_active).length;
    const inactive = users.length - active;
    const superAdmins = users.filter((user) => user.is_super_admin).length;

    return {
      total: users.length,
      active,
      inactive,
      superAdmins,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("sq");

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.username.toLocaleLowerCase("sq").includes(term) ||
        (user.full_name ?? "").toLocaleLowerCase("sq").includes(term) ||
        (user.role?.name ?? "").toLocaleLowerCase("sq").includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "super_admin" && user.is_super_admin) ||
        (roleFilter === "none" && !user.is_super_admin && user.role_id === null) ||
        (!user.is_super_admin && String(user.role_id ?? "") === roleFilter);

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [roleFilter, search, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeModal = (force = false) => {
    if (isSubmitting && !force) return;
    setModalType(null);
    setSelectedUser(null);
    setUserForm(emptyUserForm);
    setPasswordForm(emptyPasswordForm);
    setCopiedPassword(false);
    setDeleteConfirmation("");
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    setUserForm(emptyUserForm);
    setPasswordForm(emptyPasswordForm);
    setCopiedPassword(false);
    setModalType("create");
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      fullName: user.full_name ?? "",
      roleId: user.role_id === null ? "" : String(user.role_id),
    });
    setModalType("edit");
  };

  const openPasswordModal = (user: AdminUser) => {
    setSelectedUser(user);
    setPasswordForm(emptyPasswordForm);
    setCopiedPassword(false);
    setModalType("password");
  };

  const openStatusModal = (user: AdminUser) => {
    setSelectedUser(user);
    setModalType(user.is_active ? "deactivate" : "reactivate");
  };

  const openDeleteModal = (user: AdminUser) => {
    setSelectedUser(user);
    setDeleteConfirmation("");
    setModalType("delete");
  };

  const validateUserForm = () => {
    const username = normalizeUsername(userForm.username);

    if (!USERNAME_PATTERN.test(username)) {
      toast({
        title: "Username i pavlefshëm",
        description:
          "Përdor 3-50 shkronja të vogla, numra, pikë, underscore ose minus.",
        variant: "destructive",
      });
      return null;
    }

    if (userForm.fullName.trim().length > 100) {
      toast({
        title: "Emri është shumë i gjatë",
        description: "Emri mund të ketë maksimumi 100 karaktere.",
        variant: "destructive",
      });
      return null;
    }

    return {
      username,
      fullName: userForm.fullName.trim() || null,
      roleId: userForm.roleId ? Number(userForm.roleId) : null,
    };
  };

  const validatePasswordForm = (username: string) => {
    const { password, confirmPassword } = passwordForm;

    if (password !== confirmPassword) {
      toast({
        title: "Fjalëkalimet nuk përputhen",
        description: "Shkruaje të njëjtin fjalëkalim në të dy fushat.",
        variant: "destructive",
      });
      return null;
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      /\s/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      toast({
        title: "Fjalëkalimi nuk është mjaftueshëm i fortë",
        description:
          "Kërkohen së paku 12 karaktere, shkronjë e madhe, shkronjë e vogël, numër dhe simbol, pa hapësira.",
        variant: "destructive",
      });
      return null;
    }

    if (password.toLowerCase().includes(username.toLowerCase())) {
      toast({
        title: "Fjalëkalim i pasigurt",
        description: "Fjalëkalimi nuk duhet ta përmbajë username-in.",
        variant: "destructive",
      });
      return null;
    }

    return password;
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();

    const userPayload = validateUserForm();
    if (!userPayload) return;

    const password = validatePasswordForm(userPayload.username);
    if (!password) return;

    setIsSubmitting(true);

    try {
      await invokeAdminUsers({
        action: "create_user",
        ...userPayload,
        password,
      });

      toast({
        title: "Përdoruesi u krijua",
        description: `Llogaria ${userPayload.username} është aktive dhe gati për përdorim.`,
      });

      closeModal(true);
      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Krijimi dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;

    const userPayload = validateUserForm();
    if (!userPayload) return;

    setIsSubmitting(true);

    try {
      await invokeAdminUsers({
        action: "update_user",
        userId: selectedUser.user_id,
        ...userPayload,
      });

      toast({
        title: "Të dhënat u përditësuan",
        description: `Ndryshimet për ${userPayload.username} u ruajtën.`,
      });

      closeModal(true);
      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Përditësimi dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;

    const password = validatePasswordForm(selectedUser.username);
    if (!password) return;

    setIsSubmitting(true);

    try {
      await invokeAdminUsers({
        action: "set_password",
        userId: selectedUser.user_id,
        password,
      });

      toast({
        title: "Fjalëkalimi u ndryshua",
        description: `U vendos një fjalëkalim i ri për ${selectedUser.username}.`,
      });

      closeModal(true);
      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Ndryshimi dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedUser || !modalType) return;

    const action =
      modalType === "deactivate" ? "deactivate_user" : "reactivate_user";

    setIsSubmitting(true);

    try {
      await invokeAdminUsers({
        action,
        userId: selectedUser.user_id,
      });

      toast({
        title:
          modalType === "deactivate"
            ? "Përdoruesi u çaktivizua"
            : "Përdoruesi u riaktivizua",
        description:
          modalType === "deactivate"
            ? `${selectedUser.username} nuk mund të hyjë më në panel.`
            : `${selectedUser.username} mund të hyjë përsëri në panel.`,
      });

      closeModal(true);
      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Veprimi dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const normalizedConfirmation = normalizeUsername(deleteConfirmation);

    if (normalizedConfirmation !== selectedUser.username) {
      toast({
        title: "Konfirmimi nuk përputhet",
        description: `Shkruaj saktësisht ${selectedUser.username} për ta konfirmuar fshirjen.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await invokeAdminUsers({
        action: "delete_user",
        userId: selectedUser.user_id,
        confirmationUsername: normalizedConfirmation,
      });

      toast({
        title: "Përdoruesi u fshi përgjithmonë",
        description: `Llogaria @${selectedUser.username} u hoq nga paneli dhe Supabase Authentication.`,
      });

      closeModal(true);
      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Fshirja dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncStatus = async (user: AdminUser) => {
    setSyncingUserId(user.user_id);

    try {
      await invokeAdminUsers({
        action: "sync_user_status",
        userId: user.user_id,
      });

      toast({
        title: "Statusi u sinkronizua",
        description: `Gjendja e ${user.username} tani përputhet me Supabase Authentication.`,
      });

      await fetchData({ silent: true });
    } catch (error) {
      toast({
        title: "Sinkronizimi dështoi",
        description: error instanceof Error ? error.message : "Provo përsëri.",
        variant: "destructive",
      });
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateSecurePassword();
    setPasswordForm({
      password: generated,
      confirmPassword: generated,
      showPassword: true,
    });
    setCopiedPassword(false);
  };

  const handleCopyPassword = async () => {
    if (!passwordForm.password) return;

    try {
      await navigator.clipboard.writeText(passwordForm.password);
      setCopiedPassword(true);
      window.setTimeout(() => setCopiedPassword(false), 1800);
    } catch {
      toast({
        title: "Kopjimi dështoi",
        description: "Kopjoje fjalëkalimin manualisht.",
        variant: "destructive",
      });
    }
  };

  const passwordStrength = getPasswordStrength(passwordForm.password);
  const selectedRoleDescription = roles.find(
    (role) => String(role.id) === userForm.roleId,
  )?.description;

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-primary" size={28} />
          <p className="mt-3 text-sm text-muted-foreground">
            Duke ngarkuar përdoruesit...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setLocation("/admin")}
              aria-label="Kthehu në panel"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">
                Përdoruesit e Panelit
              </h1>
              <p className="mt-0.5 hidden text-xs uppercase tracking-[0.16em] text-muted-foreground sm:block">
                Qasje, role dhe siguri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-5"
          >
            <UserPlus size={17} />
            <span className="hidden sm:inline">Shto përdorues</span>
            <span className="sm:hidden">Shto</span>
          </button>
        </div>
      </header>

      <main className="mx-auto mt-7 max-w-7xl px-4 sm:px-6">
        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Gjithsej"
            value={stats.total}
            icon={Users}
            description="Llogari administrative"
          />
          <SummaryCard
            label="Aktivë"
            value={stats.active}
            icon={UserCheck}
            description="Me qasje në panel"
          />
          <SummaryCard
            label="Joaktivë"
            value={stats.inactive}
            icon={UserX}
            description="Qasje e bllokuar"
          />
          <SummaryCard
            label="Super Adminë"
            value={stats.superAdmins}
            icon={ShieldCheck}
            description="Qasje e plotë"
          />
        </section>

        <section className="glass-panel overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kërko emër, username ose rol..."
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Pastro kërkimin"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  aria-label="Filtro sipas statusit"
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="all">Të gjitha statuset</option>
                  <option value="active">Vetëm aktivë</option>
                  <option value="inactive">Vetëm joaktivë</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  aria-label="Filtro sipas rolit"
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="all">Të gjitha rolet</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="none">Pa rol</option>
                  {roles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void fetchData({ silent: true })}
                  disabled={isRefreshing}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  Rifresko
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Po shfaqen{" "}
                <span className="font-semibold text-foreground">
                  {filteredUsers.length}
                </span>{" "}
                nga {users.length} përdorues.
              </p>
              <p>Ndryshimet sensitive regjistrohen në audit log.</p>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-4 font-semibold">Përdoruesi</th>
                  <th className="px-5 py-4 font-semibold">Roli</th>
                  <th className="px-5 py-4 font-semibold">Statusi</th>
                  <th className="px-5 py-4 font-semibold">Hyrja e fundit</th>
                  <th className="px-5 py-4 font-semibold">Përditësuar</th>
                  <th className="px-5 py-4 text-right font-semibold">Veprimet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleUsers.map((user) => {
                  const mismatch = hasStatusMismatch(user);
                  const isCurrentUser = user.user_id === userProfile?.user_id;

                  return (
                    <tr
                      key={user.user_id}
                      className="transition-colors hover:bg-muted/25"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                            {getInitials(user)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-foreground">
                                {user.full_name || user.username}
                              </p>
                              {isCurrentUser && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  Ju
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {user.is_super_admin ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            <ShieldCheck size={13} />
                            Super Admin
                          </span>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {user.role?.name || "Pa rol"}
                            </p>
                            {user.role?.description && (
                              <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">
                                {user.role.description}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge active={user.is_active} />
                          {mismatch && (
                            <span
                              title="Statusi në databazë dhe Authentication nuk përputhet. Përdor butonin e statusit për ta sinkronizuar."
                              className="text-amber-500"
                            >
                              <TriangleAlert size={15} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-foreground">
                          {formatDateTime(user.last_sign_in_at)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-foreground">
                          {formatDateTime(user.updated_at)}
                        </p>
                        {user.password_changed_at && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Password: {formatDateTime(user.password_changed_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {user.is_super_admin ? (
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <LockKeyhole size={15} />
                              E mbrojtur
                            </span>
                          ) : (
                            <>
                              {mismatch && (
                                <IconButton
                                  label="Sinkronizo statusin me Authentication"
                                  onClick={() => void handleSyncStatus(user)}
                                  disabled={syncingUserId === user.user_id}
                                >
                                  <RefreshCw
                                    size={15}
                                    className={
                                      syncingUserId === user.user_id
                                        ? "animate-spin"
                                        : ""
                                    }
                                  />
                                </IconButton>
                              )}
                              <IconButton
                                label="Ndrysho të dhënat"
                                onClick={() => openEditModal(user)}
                              >
                                <Pencil size={15} />
                              </IconButton>
                              <IconButton
                                label="Ndrysho fjalëkalimin"
                                onClick={() => openPasswordModal(user)}
                              >
                                <KeyRound size={15} />
                              </IconButton>
                              <IconButton
                                label={
                                  user.is_active
                                    ? "Çaktivizo përdoruesin"
                                    : "Riaktivizo përdoruesin"
                                }
                                onClick={() => openStatusModal(user)}
                                danger={user.is_active}
                              >
                                {user.is_active ? (
                                  <PowerOff size={15} />
                                ) : (
                                  <Power size={15} />
                                )}
                              </IconButton>
                              {!user.is_active && (
                                <IconButton
                                  label="Fshi përgjithmonë"
                                  onClick={() => openDeleteModal(user)}
                                  danger
                                >
                                  <Trash2 size={15} />
                                </IconButton>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {visibleUsers.map((user) => {
              const mismatch = hasStatusMismatch(user);
              const isCurrentUser = user.user_id === userProfile?.user_id;

              return (
                <article key={user.user_id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(user)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">
                          {user.full_name || user.username}
                        </h3>
                        {isCurrentUser && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Ju
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                    <StatusBadge active={user.is_active} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-background/45 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Roli</p>
                      <p className="mt-1 font-medium text-foreground">
                        {user.is_super_admin
                          ? "Super Admin"
                          : user.role?.name || "Pa rol"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hyrja e fundit</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatDateTime(user.last_sign_in_at)}
                      </p>
                    </div>
                  </div>

                  {mismatch && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
                      <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                      <p>
                        Statusi kërkon sinkronizim. Përdor veprimin e statusit më
                        poshtë.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 size={13} />
                      {formatDateTime(user.updated_at)}
                    </p>

                    {user.is_super_admin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LockKeyhole size={14} /> E mbrojtur
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        {mismatch && (
                          <IconButton
                            label="Sinkronizo statusin me Authentication"
                            onClick={() => void handleSyncStatus(user)}
                            disabled={syncingUserId === user.user_id}
                          >
                            <RefreshCw
                              size={15}
                              className={
                                syncingUserId === user.user_id
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                          </IconButton>
                        )}
                        <IconButton
                          label="Ndrysho të dhënat"
                          onClick={() => openEditModal(user)}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          label="Ndrysho fjalëkalimin"
                          onClick={() => openPasswordModal(user)}
                        >
                          <KeyRound size={15} />
                        </IconButton>
                        <IconButton
                          label={
                            user.is_active
                              ? "Çaktivizo përdoruesin"
                              : "Riaktivizo përdoruesin"
                          }
                          onClick={() => openStatusModal(user)}
                          danger={user.is_active}
                        >
                          {user.is_active ? (
                            <PowerOff size={15} />
                          ) : (
                            <Power size={15} />
                          )}
                        </IconButton>
                        {!user.is_active && (
                          <IconButton
                            label="Fshi përgjithmonë"
                            onClick={() => openDeleteModal(user)}
                            danger
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                <Search size={22} />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">
                Asnjë përdorues nuk u gjet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ndrysho kërkimin ose filtrat e zgjedhur.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
                className="mt-5 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Pastro filtrat
              </button>
            </div>
          )}

          {filteredUsers.length > PAGE_SIZE && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-4 sm:flex-row sm:px-5">
              <p className="text-xs text-muted-foreground">
                Faqja {safePage} nga {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  aria-label="Faqja e mëparshme"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="min-w-20 text-center text-sm font-semibold text-foreground">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage === totalPages}
                  aria-label="Faqja tjetër"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {modalType === "create" && (
        <ModalShell
          title="Shto përdorues"
          description="Krijo një llogari të re të lidhur drejtpërdrejt me Supabase Authentication."
          onClose={closeModal}
          closeDisabled={isSubmitting}
        >
          <form onSubmit={handleCreateUser} className="space-y-5 p-5 sm:p-7">
            <div>
              <FieldLabel>Emri dhe mbiemri</FieldLabel>
              <input
                type="text"
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                maxLength={100}
                autoComplete="name"
                placeholder="p.sh. Ardit Krasniqi"
                className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div>
              <FieldLabel>Username</FieldLabel>
              <div className="flex overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary">
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      username: normalizeUsername(event.target.value),
                    }))
                  }
                  required
                  minLength={3}
                  maxLength={50}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ardit"
                  className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="flex items-center border-l border-border px-3 text-xs text-muted-foreground">
                  @admin.local
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Vetëm shkronja të vogla, numra, pikë, underscore dhe minus.
              </p>
            </div>

            <div>
              <FieldLabel>Roli</FieldLabel>
              <select
                value={userForm.roleId}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    roleId: event.target.value,
                  }))
                }
                className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                <option value="">Pa rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {role.name}
                  </option>
                ))}
              </select>
              {selectedRoleDescription && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {selectedRoleDescription}
                </p>
              )}
            </div>

            <PasswordFields
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              strength={passwordStrength}
              copied={copiedPassword}
              onGenerate={handleGeneratePassword}
              onCopy={() => void handleCopyPassword()}
            />

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={isSubmitting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                {isSubmitting ? "Duke krijuar..." : "Krijo përdoruesin"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modalType === "edit" && selectedUser && (
        <ModalShell
          title="Ndrysho përdoruesin"
          description={`Përditëso të dhënat dhe rolin e @${selectedUser.username}.`}
          onClose={closeModal}
          closeDisabled={isSubmitting}
        >
          <form onSubmit={handleUpdateUser} className="space-y-5 p-5 sm:p-7">
            <div>
              <FieldLabel>Emri dhe mbiemri</FieldLabel>
              <input
                type="text"
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                maxLength={100}
                autoComplete="name"
                className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div>
              <FieldLabel>Username</FieldLabel>
              <div className="flex overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary">
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      username: normalizeUsername(event.target.value),
                    }))
                  }
                  required
                  minLength={3}
                  maxLength={50}
                  spellCheck={false}
                  className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none"
                />
                <span className="flex items-center border-l border-border px-3 text-xs text-muted-foreground">
                  @admin.local
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Ndryshimi i username-it përditëson edhe email-in teknik në
                Supabase Authentication.
              </p>
            </div>

            <div>
              <FieldLabel>Roli</FieldLabel>
              <select
                value={userForm.roleId}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    roleId: event.target.value,
                  }))
                }
                className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                <option value="">Pa rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {role.name}
                  </option>
                ))}
              </select>
              {selectedRoleDescription && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {selectedRoleDescription}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={isSubmitting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {isSubmitting ? "Duke ruajtur..." : "Ruaj ndryshimet"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modalType === "password" && selectedUser && (
        <ModalShell
          title="Ndrysho fjalëkalimin"
          description={`Vendos një fjalëkalim të ri për @${selectedUser.username}. Fjalëkalimi aktual nuk shfaqet dhe nuk ruhet në databazë.`}
          onClose={closeModal}
          closeDisabled={isSubmitting}
        >
          <form onSubmit={handleSetPassword} className="space-y-5 p-5 sm:p-7">
            <PasswordFields
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              strength={passwordStrength}
              copied={copiedPassword}
              onGenerate={handleGeneratePassword}
              onCopy={() => void handleCopyPassword()}
            />

            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
              Pas ruajtjes, përdoruesi duhet të përdorë fjalëkalimin e ri në hyrjen
              e ardhshme.
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={isSubmitting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                {isSubmitting ? "Duke ndryshuar..." : "Ndrysho fjalëkalimin"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {(modalType === "deactivate" || modalType === "reactivate") &&
        selectedUser && (
          <ModalShell
            title={
              modalType === "deactivate"
                ? "Çaktivizo përdoruesin"
                : "Riaktivizo përdoruesin"
            }
            description={
              modalType === "deactivate"
                ? "Qasja do të bllokohet në databazë dhe në Supabase Authentication."
                : "Qasja do të rikthehet në databazë dhe në Supabase Authentication."
            }
            onClose={closeModal}
            closeDisabled={isSubmitting}
          >
            <div className="p-5 sm:p-7">
              <div
                className={`rounded-2xl border p-5 ${
                  modalType === "deactivate"
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-primary/20 bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      modalType === "deactivate"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {modalType === "deactivate" ? (
                      <PowerOff size={20} />
                    ) : (
                      <Power size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedUser.full_name || selectedUser.username}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      @{selectedUser.username}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                  {modalType === "deactivate"
                    ? "Përdoruesi nuk do të mund të hyjë ose të përdorë funksionet administrative. Të dhënat, roli dhe historiku i tij do të ruhen për riaktivizim të mëvonshëm."
                    : "Përdoruesi do të mund të hyjë përsëri me username-in dhe fjalëkalimin e tij ekzistues."}
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
                >
                  Anulo
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusChange()}
                  disabled={isSubmitting}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors disabled:opacity-50 ${
                    modalType === "deactivate"
                      ? "bg-red-500 text-white hover:bg-red-500/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : modalType === "deactivate" ? (
                    <PowerOff size={16} />
                  ) : (
                    <Power size={16} />
                  )}
                  {isSubmitting
                    ? "Duke përpunuar..."
                    : modalType === "deactivate"
                      ? "Po, çaktivizoje"
                      : "Po, riaktivizoje"}
                </button>
              </div>
            </div>
          </ModalShell>
        )}

      {modalType === "delete" && selectedUser && (
        <ModalShell
          title="Fshi përdoruesin përgjithmonë"
          description="Ky veprim heq llogarinë nga paneli dhe nga Supabase Authentication dhe nuk mund të zhbëhet."
          onClose={closeModal}
          closeDisabled={isSubmitting}
        >
          <div className="space-y-5 p-5 sm:p-7">
            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <Trash2 size={20} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedUser.full_name || selectedUser.username}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    @{selectedUser.username}
                  </p>
                </div>
              </div>

              <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>• Llogaria e hyrjes dhe kredencialet do të fshihen.</li>
                <li>• Profili në admin_users do të hiqet automatikisht.</li>
                <li>• Riaktivizimi nuk do të jetë më i mundur.</li>
                <li>• Një shënim minimal sigurie ruhet në audit log.</li>
              </ul>
            </div>

            <div>
              <FieldLabel>
                Për konfirmim, shkruaj username-in
                <span className="ml-1 font-mono text-red-400">
                  {selectedUser.username}
                </span>
              </FieldLabel>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={selectedUser.username}
                className="h-12 w-full rounded-xl border border-red-500/25 bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-400"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={isSubmitting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                disabled={
                  isSubmitting ||
                  normalizeUsername(deleteConfirmation) !== selectedUser.username
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white transition-colors hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {isSubmitting ? "Duke fshirë..." : "Fshi përgjithmonë"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function PasswordFields({
  passwordForm,
  setPasswordForm,
  strength,
  copied,
  onGenerate,
  onCopy,
}: {
  passwordForm: PasswordFormState;
  setPasswordForm: React.Dispatch<React.SetStateAction<PasswordFormState>>;
  strength: { score: number; label: string };
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel>Fjalëkalimi i ri</FieldLabel>
        <button
          type="button"
          onClick={onGenerate}
          className="text-xs font-semibold text-primary transition-colors hover:text-foreground"
        >
          Gjenero fjalëkalim të sigurt
        </button>
      </div>

      <div className="relative">
        <input
          type={passwordForm.showPassword ? "text" : "password"}
          value={passwordForm.password}
          onChange={(event) =>
            setPasswordForm((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          autoComplete="new-password"
          placeholder="Minimum 12 karaktere"
          className="h-12 w-full rounded-xl border border-border bg-background pl-4 pr-24 font-mono text-sm text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            disabled={!passwordForm.password}
            aria-label="Kopjo fjalëkalimin"
            title="Kopjo fjalëkalimin"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            onClick={() =>
              setPasswordForm((current) => ({
                ...current,
                showPassword: !current.showPassword,
              }))
            }
            aria-label={
              passwordForm.showPassword
                ? "Fshih fjalëkalimin"
                : "Shfaq fjalëkalimin"
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {passwordForm.showPassword ? (
              <EyeOff size={15} />
            ) : (
              <Eye size={15} />
            )}
          </button>
        </div>
      </div>

      <div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                strength.score >= level ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Siguria</span>
          <span
            className={
              passwordForm.password ? "font-semibold text-primary" : "text-muted-foreground"
            }
          >
            {passwordForm.password ? strength.label : "Pa vlerësim"}
          </span>
        </div>
      </div>

      <div>
        <FieldLabel>Konfirmo fjalëkalimin</FieldLabel>
        <input
          type={passwordForm.showPassword ? "text" : "password"}
          value={passwordForm.confirmPassword}
          onChange={(event) =>
            setPasswordForm((current) => ({
              ...current,
              confirmPassword: event.target.value,
            }))
          }
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          autoComplete="new-password"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary"
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Kërkohen së paku 12 karaktere, një shkronjë e madhe, një e vogël, një
        numër dhe një simbol. Fjalëkalimi nuk duhet ta përmbajë username-in.
      </p>
    </div>
  );
}
