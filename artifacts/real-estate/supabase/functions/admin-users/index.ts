import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type ActionBody =
  | { action: "list" }
  | {
      action: "create_user";
      username: string;
      fullName?: string | null;
      roleId?: number | null;
      password: string;
    }
  | {
      action: "update_user";
      userId: string;
      username: string;
      fullName?: string | null;
      roleId?: number | null;
    }
  | {
      action: "set_password";
      userId: string;
      password: string;
    }
  | {
      action: "deactivate_user";
      userId: string;
    }
  | {
      action: "reactivate_user";
      userId: string;
    }
  | {
      action: "sync_user_status";
      userId: string;
    };

type AdminProfile = {
  user_id: string;
  username: string;
  full_name: string | null;
  role_id: number | null;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  password_changed_at: string | null;
  admin_roles:
    | {
        id: number;
        name: string;
        description: string | null;
      }
    | {
        id: number;
        name: string;
        description: string | null;
      }[]
    | null;
};

class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const MAX_FULL_NAME_LENGTH = 100;
const LONG_BAN_DURATION = "876000h";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://auraks.com",
  "https://www.auraks.com",
  "https://property-showcase-real-estate.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

function getSecretKey(): string {
  const legacyServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRole) return legacyServiceRole;

  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (rawSecretKeys) {
    try {
      const parsed = JSON.parse(rawSecretKeys) as Record<string, string>;
      const preferred = parsed.default || Object.values(parsed)[0];
      if (preferred) return preferred;
    } catch {
      throw new Error("SUPABASE_SECRET_KEYS is not valid JSON.");
    }
  }

  throw new Error("No Supabase server secret is available to the Edge Function.");
}

function getAllowedOrigins(): string[] {
  const configured = Deno.env.get("ADMIN_ALLOWED_ORIGINS");

  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  const values = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : DEFAULT_ALLOWED_ORIGINS;
}

function createCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = !origin || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  status: number,
  payload: JsonRecord,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...createCorsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeFullName(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) return null;

  if (normalized.length > MAX_FULL_NAME_LENGTH) {
    throw new AppError(
      400,
      "full_name_too_long",
      `Emri mund të ketë maksimumi ${MAX_FULL_NAME_LENGTH} karaktere.`,
    );
  }

  return normalized;
}

function validateUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      400,
      "invalid_username",
      "Username duhet të ketë 3-50 karaktere dhe mund të përmbajë vetëm shkronja të vogla, numra, pikë, underscore ose minus.",
    );
  }
}

function validatePassword(password: unknown, username?: string): string {
  const value = String(password ?? "");

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      400,
      "invalid_password_length",
      `Fjalëkalimi duhet të ketë ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karaktere.`,
    );
  }

  if (/\s/.test(value)) {
    throw new AppError(
      400,
      "password_contains_spaces",
      "Fjalëkalimi nuk duhet të përmbajë hapësira.",
    );
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new AppError(
      400,
      "weak_password",
      "Fjalëkalimi duhet të përmbajë së paku një shkronjë të madhe, një të vogël, një numër dhe një simbol.",
    );
  }

  if (username && value.toLowerCase().includes(username.toLowerCase())) {
    throw new AppError(
      400,
      "password_contains_username",
      "Fjalëkalimi nuk duhet ta përmbajë username-in.",
    );
  }

  return value;
}

function parseRoleId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "invalid_role", "Roli i zgjedhur nuk është i vlefshëm.");
  }

  return parsed;
}

function requireUuid(value: unknown, fieldName = "userId"): string {
  const normalized = String(value ?? "").trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    throw new AppError(400, "invalid_user_id", `${fieldName} nuk është i vlefshëm.`);
  }

  return normalized;
}

function getRequestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const requestIp = forwardedFor?.split(",")[0]?.trim() || null;

  return {
    request_ip: requestIp,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
  };
}

async function validateRole(
  supabaseAdmin: SupabaseClient,
  roleId: number | null,
): Promise<{ id: number; name: string } | null> {
  if (roleId === null) return null;

  const { data, error } = await supabaseAdmin
    .from("admin_roles")
    .select("id, name")
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    console.error("Role validation error:", error);
    throw new AppError(500, "role_lookup_failed", "Roli nuk mund të verifikohej.");
  }

  if (!data) {
    throw new AppError(400, "role_not_found", "Roli i zgjedhur nuk ekziston.");
  }

  return { id: Number(data.id), name: String(data.name) };
}

async function requireActiveSuperAdmin(
  request: Request,
  supabaseAdmin: SupabaseClient,
): Promise<User> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "missing_token", "Sesioni i administratorit mungon.");
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    throw new AppError(401, "invalid_token", "Sesioni ka skaduar. Hyni përsëri.");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("admin_users")
    .select("user_id, is_active, is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Caller profile lookup error:", profileError);
    throw new AppError(500, "authorization_check_failed", "Autorizimi nuk mund të verifikohej.");
  }

  if (!profile?.is_active || !profile?.is_super_admin) {
    throw new AppError(403, "super_admin_required", "Vetëm një Super Admin aktiv mund ta kryejë këtë veprim.");
  }

  return user;
}

async function getTargetProfile(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<AdminProfile> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(
      `
        user_id,
        username,
        full_name,
        role_id,
        is_super_admin,
        is_active,
        created_at,
        updated_at,
        deactivated_at,
        password_changed_at,
        admin_roles (
          id,
          name,
          description
        )
      `,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Target profile lookup error:", error);
    throw new AppError(500, "target_lookup_failed", "Përdoruesi nuk mund të lexohej.");
  }

  if (!data) {
    throw new AppError(404, "user_not_found", "Përdoruesi nuk u gjet.");
  }

  return data as AdminProfile;
}

function assertEditableTarget(target: AdminProfile): void {
  if (target.is_super_admin) {
    throw new AppError(
      403,
      "protected_super_admin",
      "Llogaria e Super Adminit është e mbrojtur dhe nuk ndryshohet nga kjo faqe.",
    );
  }
}

async function writeAuditLog(
  request: Request,
  supabaseAdmin: SupabaseClient,
  actorUserId: string,
  targetUserId: string,
  action: string,
  details: JsonRecord = {},
): Promise<void> {
  const metadata = getRequestMetadata(request);

  const { error } = await supabaseAdmin.from("admin_user_audit_log").insert({
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    action,
    details,
    ...metadata,
  });

  if (error) {
    // A logging failure must be visible in function logs, but should not leave a
    // completed Auth operation in an inconsistent state.
    console.error("Admin user audit log insert failed:", error);
  }
}

async function listAllAuthUsers(supabaseAdmin: SupabaseClient): Promise<User[]> {
  const allUsers: User[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error("Auth users list error:", error);
      throw new AppError(500, "auth_users_list_failed", "Llogaritë e autentikimit nuk u ngarkuan.");
    }

    allUsers.push(...data.users);

    if (data.users.length < perPage) break;
  }

  return allUsers;
}

function normalizeRole(profile: AdminProfile) {
  const relation = profile.admin_roles;
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

async function handleList(supabaseAdmin: SupabaseClient) {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, authUsers] =
    await Promise.all([
      supabaseAdmin
        .from("admin_users")
        .select(
          `
            user_id,
            username,
            full_name,
            role_id,
            is_super_admin,
            is_active,
            created_at,
            updated_at,
            deactivated_at,
            password_changed_at,
            admin_roles (
              id,
              name,
              description
            )
          `,
        )
        .order("is_super_admin", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("admin_roles")
        .select("id, name, description")
        .order("id", { ascending: true }),
      listAllAuthUsers(supabaseAdmin),
    ]);

  if (profilesError) {
    console.error("Admin profiles list error:", profilesError);
    throw new AppError(500, "profiles_list_failed", "Përdoruesit nuk u ngarkuan.");
  }

  if (rolesError) {
    console.error("Admin roles list error:", rolesError);
    throw new AppError(500, "roles_list_failed", "Rolet nuk u ngarkuan.");
  }

  const authById = new Map(authUsers.map((user) => [user.id, user]));

  const users = ((profiles ?? []) as AdminProfile[]).map((profile) => {
    const authUser = authById.get(profile.user_id);

    return {
      user_id: profile.user_id,
      username: profile.username,
      full_name: profile.full_name,
      role_id: profile.role_id,
      role: normalizeRole(profile),
      is_super_admin: profile.is_super_admin,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      deactivated_at: profile.deactivated_at,
      password_changed_at: profile.password_changed_at,
      auth_email: authUser?.email ?? null,
      auth_banned_until: authUser?.banned_until ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
    };
  });

  return {
    users,
    roles: (roles ?? []).map((role) => ({
      id: Number(role.id),
      name: String(role.name),
      description: role.description ? String(role.description) : null,
    })),
  };
}

async function handleCreateUser(
  request: Request,
  body: Extract<ActionBody, { action: "create_user" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const username = normalizeUsername(body.username);
  const fullName = normalizeFullName(body.fullName);
  const roleId = parseRoleId(body.roleId);

  validateUsername(username);
  const password = validatePassword(body.password, username);
  const role = await validateRole(supabaseAdmin, roleId);

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (existingProfileError) {
    console.error("Username uniqueness lookup error:", existingProfileError);
    throw new AppError(500, "username_check_failed", "Username nuk mund të verifikohej.");
  }

  if (existingProfile) {
    throw new AppError(409, "username_exists", "Ky username ekziston tashmë.");
  }

  const email = `${username}@admin.local`;
  const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
    },
    app_metadata: {
      auraks_admin: true,
    },
  });

  if (createAuthError || !createdAuth.user) {
    console.error("Create Auth user error:", createAuthError);

    if (createAuthError?.message?.toLowerCase().includes("already")) {
      throw new AppError(409, "auth_user_exists", "Një llogari me këtë username ekziston tashmë në Authentication.");
    }

    throw new AppError(500, "auth_user_create_failed", "Llogaria e autentikimit nuk u krijua.");
  }

  const createdUserId = createdAuth.user.id;
  const now = new Date().toISOString();

  const { error: profileInsertError } = await supabaseAdmin.from("admin_users").insert({
    user_id: createdUserId,
    username,
    full_name: fullName,
    role_id: roleId,
    is_super_admin: false,
    is_active: true,
    created_by: caller.id,
    updated_by: caller.id,
    updated_at: now,
  });

  if (profileInsertError) {
    console.error("Admin profile insert error:", profileInsertError);

    const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    if (rollbackError) {
      console.error("Create-user Auth rollback failed:", rollbackError);
    }

    if (profileInsertError.code === "23505") {
      throw new AppError(409, "username_exists", "Ky username ekziston tashmë.");
    }

    throw new AppError(500, "profile_create_failed", "Profili administrativ nuk u krijua. Veprimi u anulua.");
  }

  await writeAuditLog(request, supabaseAdmin, caller.id, createdUserId, "user_created", {
    username,
    full_name: fullName,
    role_id: roleId,
    role_name: role?.name ?? null,
  });

  return {
    user_id: createdUserId,
    username,
  };
}

async function handleUpdateUser(
  request: Request,
  body: Extract<ActionBody, { action: "update_user" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const userId = requireUuid(body.userId);
  const username = normalizeUsername(body.username);
  const fullName = normalizeFullName(body.fullName);
  const roleId = parseRoleId(body.roleId);

  validateUsername(username);
  const role = await validateRole(supabaseAdmin, roleId);
  const target = await getTargetProfile(supabaseAdmin, userId);
  assertEditableTarget(target);

  const { data: conflictingProfile, error: conflictError } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("username", username)
    .neq("user_id", userId)
    .maybeSingle();

  if (conflictError) {
    console.error("Update username conflict lookup error:", conflictError);
    throw new AppError(500, "username_check_failed", "Username nuk mund të verifikohej.");
  }

  if (conflictingProfile) {
    throw new AppError(409, "username_exists", "Ky username përdoret nga një llogari tjetër.");
  }

  const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authLookupError || !authLookup.user) {
    console.error("Target Auth user lookup error:", authLookupError);
    throw new AppError(500, "auth_user_lookup_failed", "Llogaria e autentikimit nuk u gjet.");
  }

  const oldAuthUser = authLookup.user;
  const usernameChanged = username !== target.username;
  const newEmail = `${username}@admin.local`;

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ...(usernameChanged ? { email: newEmail, email_confirm: true } : {}),
    user_metadata: {
      ...(oldAuthUser.user_metadata ?? {}),
      username,
      full_name: fullName,
    },
  });

  if (authUpdateError) {
    console.error("Target Auth user update error:", authUpdateError);

    if (authUpdateError.message?.toLowerCase().includes("already")) {
      throw new AppError(409, "auth_email_exists", "Ky username përdoret tashmë nga një llogari tjetër.");
    }

    throw new AppError(500, "auth_user_update_failed", "Llogaria e autentikimit nuk u përditësua.");
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from("admin_users")
    .update({
      username,
      full_name: fullName,
      role_id: roleId,
      updated_at: new Date().toISOString(),
      updated_by: caller.id,
    })
    .eq("user_id", userId);

  if (profileUpdateError) {
    console.error("Admin profile update error:", profileUpdateError);

    const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ...(usernameChanged && oldAuthUser.email
        ? { email: oldAuthUser.email, email_confirm: true }
        : {}),
      user_metadata: oldAuthUser.user_metadata ?? {},
    });

    if (rollbackError) {
      console.error("Update-user Auth rollback failed:", rollbackError);
    }

    if (profileUpdateError.code === "23505") {
      throw new AppError(409, "username_exists", "Ky username përdoret tashmë nga një llogari tjetër.");
    }

    throw new AppError(500, "profile_update_failed", "Profili nuk u përditësua. Veprimi u anulua.");
  }

  const roleChanged = target.role_id !== roleId;
  const profileChanged =
    target.username !== username ||
    (target.full_name ?? null) !== fullName ||
    roleChanged;

  if (profileChanged) {
    await writeAuditLog(request, supabaseAdmin, caller.id, userId, "profile_updated", {
      old_username: target.username,
      new_username: username,
      old_full_name: target.full_name,
      new_full_name: fullName,
      old_role_id: target.role_id,
      new_role_id: roleId,
      new_role_name: role?.name ?? null,
    });
  }

  if (roleChanged) {
    await writeAuditLog(request, supabaseAdmin, caller.id, userId, "role_changed", {
      old_role_id: target.role_id,
      new_role_id: roleId,
      new_role_name: role?.name ?? null,
    });
  }

  return {
    user_id: userId,
    username,
  };
}

async function handleSetPassword(
  request: Request,
  body: Extract<ActionBody, { action: "set_password" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const userId = requireUuid(body.userId);
  const target = await getTargetProfile(supabaseAdmin, userId);
  assertEditableTarget(target);

  const password = validatePassword(body.password, target.username);

  const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });

  if (passwordError) {
    console.error("Set password error:", passwordError);
    throw new AppError(500, "password_update_failed", "Fjalëkalimi nuk u ndryshua.");
  }

  const now = new Date().toISOString();
  const { error: metadataError } = await supabaseAdmin
    .from("admin_users")
    .update({
      password_changed_at: now,
      password_changed_by: caller.id,
      updated_at: now,
      updated_by: caller.id,
    })
    .eq("user_id", userId);

  if (metadataError) {
    console.error("Password metadata update failed:", metadataError);
    // The password is already changed. Return success and preserve the primary
    // security operation instead of claiming that it failed.
  }

  await writeAuditLog(request, supabaseAdmin, caller.id, userId, "password_changed", {
    username: target.username,
  });

  return { user_id: userId };
}

async function handleDeactivateUser(
  request: Request,
  body: Extract<ActionBody, { action: "deactivate_user" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const userId = requireUuid(body.userId);

  if (userId === caller.id) {
    throw new AppError(400, "cannot_deactivate_self", "Nuk mund ta çaktivizoni llogarinë tuaj.");
  }

  const target = await getTargetProfile(supabaseAdmin, userId);
  assertEditableTarget(target);

  const now = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin
    .from("admin_users")
    .update({
      is_active: false,
      deactivated_at: now,
      deactivated_by: caller.id,
      updated_at: now,
      updated_by: caller.id,
    })
    .eq("user_id", userId);

  if (profileError) {
    console.error("Deactivate profile error:", profileError);
    throw new AppError(500, "deactivate_profile_failed", "Përdoruesi nuk u çaktivizua.");
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: LONG_BAN_DURATION,
  });

  if (banError) {
    console.error("Deactivate Auth ban error:", banError);

    const { error: rollbackError } = await supabaseAdmin
      .from("admin_users")
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        updated_at: new Date().toISOString(),
        updated_by: caller.id,
      })
      .eq("user_id", userId);

    if (rollbackError) {
      console.error("Deactivate profile rollback failed:", rollbackError);
    }

    throw new AppError(500, "deactivate_auth_failed", "Bllokimi në Authentication dështoi. Veprimi u anulua.");
  }

  await writeAuditLog(request, supabaseAdmin, caller.id, userId, "user_deactivated", {
    username: target.username,
  });

  return { user_id: userId };
}

async function handleReactivateUser(
  request: Request,
  body: Extract<ActionBody, { action: "reactivate_user" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const userId = requireUuid(body.userId);
  const target = await getTargetProfile(supabaseAdmin, userId);
  assertEditableTarget(target);

  const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (unbanError) {
    console.error("Reactivate Auth unban error:", unbanError);
    throw new AppError(500, "reactivate_auth_failed", "Llogaria nuk u riaktivizua në Authentication.");
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin
    .from("admin_users")
    .update({
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
      updated_at: now,
      updated_by: caller.id,
    })
    .eq("user_id", userId);

  if (profileError) {
    console.error("Reactivate profile error:", profileError);

    const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: LONG_BAN_DURATION,
    });

    if (rollbackError) {
      console.error("Reactivate Auth rollback failed:", rollbackError);
    }

    throw new AppError(500, "reactivate_profile_failed", "Profili nuk u riaktivizua. Veprimi u anulua.");
  }

  await writeAuditLog(request, supabaseAdmin, caller.id, userId, "user_reactivated", {
    username: target.username,
  });

  return { user_id: userId };
}

async function handleSyncUserStatus(
  request: Request,
  body: Extract<ActionBody, { action: "sync_user_status" }>,
  caller: User,
  supabaseAdmin: SupabaseClient,
) {
  const userId = requireUuid(body.userId);
  const target = await getTargetProfile(supabaseAdmin, userId);
  assertEditableTarget(target);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: target.is_active ? "none" : LONG_BAN_DURATION,
  });

  if (error) {
    console.error("Sync Auth status error:", error);
    throw new AppError(500, "status_sync_failed", "Statusi nuk u sinkronizua me Authentication.");
  }

  await writeAuditLog(request, supabaseAdmin, caller.id, userId, "status_synchronized", {
    username: target.username,
    database_is_active: target.is_active,
  });

  return { user_id: userId, is_active: target.is_active };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: createCorsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, 405, {
      success: false,
      code: "method_not_allowed",
      message: "Lejohet vetëm metoda POST.",
    });
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && !getAllowedOrigins().includes(requestOrigin)) {
    return jsonResponse(request, 403, {
      success: false,
      code: "origin_not_allowed",
      message: "Origjina e kërkesës nuk lejohet.",
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is missing.");
    }

    const supabaseAdmin = createClient(supabaseUrl, getSecretKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const caller = await requireActiveSuperAdmin(request, supabaseAdmin);

    let body: ActionBody;
    try {
      body = (await request.json()) as ActionBody;
    } catch {
      throw new AppError(400, "invalid_json", "Kërkesa nuk përmban JSON të vlefshëm.");
    }

    if (!body || typeof body !== "object" || !("action" in body)) {
      throw new AppError(400, "missing_action", "Veprimi mungon.");
    }

    let data: unknown;

    switch (body.action) {
      case "list":
        data = await handleList(supabaseAdmin);
        break;
      case "create_user":
        data = await handleCreateUser(request, body, caller, supabaseAdmin);
        break;
      case "update_user":
        data = await handleUpdateUser(request, body, caller, supabaseAdmin);
        break;
      case "set_password":
        data = await handleSetPassword(request, body, caller, supabaseAdmin);
        break;
      case "deactivate_user":
        data = await handleDeactivateUser(request, body, caller, supabaseAdmin);
        break;
      case "reactivate_user":
        data = await handleReactivateUser(request, body, caller, supabaseAdmin);
        break;
      case "sync_user_status":
        data = await handleSyncUserStatus(request, body, caller, supabaseAdmin);
        break;
      default:
        throw new AppError(400, "unknown_action", "Veprimi i kërkuar nuk njihet.");
    }

    return jsonResponse(request, 200, {
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse(request, error.status, {
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Unhandled admin-users function error:", error);

    return jsonResponse(request, 500, {
      success: false,
      code: "internal_error",
      message: "Ndodhi një gabim i papritur në server.",
    });
  }
});
