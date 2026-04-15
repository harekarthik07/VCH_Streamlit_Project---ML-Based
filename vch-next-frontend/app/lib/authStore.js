const USERS_KEY = "vch-users";
const SESSIONS_KEY = "vch-sessions";
const AUTH_KEY = "vch-auth";

export const DEFAULT_USERS = {
  admin: { displayName: "admin", password: "test@123", role: "admin" },
  user: { displayName: "user", password: "user@123", role: "user" },
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson(key, fallback) {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeUsername(value = "") {
  return value.trim().toLowerCase();
}

export function getUsers() {
  const users = readJson(USERS_KEY, null);
  if (users && typeof users === "object" && Object.keys(users).length > 0) {
    return users;
  }

  writeJson(USERS_KEY, DEFAULT_USERS);
  return DEFAULT_USERS;
}

export function saveUsers(users) {
  writeJson(USERS_KEY, users);
}

export function getSessions() {
  return readJson(SESSIONS_KEY, {});
}

export function saveSessions(sessions) {
  writeJson(SESSIONS_KEY, sessions);
}

export function getAuthSession() {
  return readJson(AUTH_KEY, null);
}

export function setAuthSession(session) {
  writeJson(AUTH_KEY, session);
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_KEY);
}

export function authenticateUser(username, password) {
  const key = normalizeUsername(username);
  const users = getUsers();
  const user = users[key];

  if (!user || user.password !== password) {
    return { ok: false };
  }

  return {
    ok: true,
    user: {
      username: user.displayName || key,
      role: user.role || "user",
    },
  };
}

export function createSessionId(username) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${normalizeUsername(username)}-${Date.now()}`;
}

export function ensureActiveSession(auth) {
  if (!auth?.username) {
    return { ok: false, reason: "missing-auth" };
  }

  const sessions = getSessions();
  const sessionId = auth.sessionId || createSessionId(auth.username);
  const existing = sessions[sessionId];

  if (existing?.status === "terminated") {
    return { ok: false, reason: "terminated", sessionId };
  }

  sessions[sessionId] = {
    username: auth.username,
    login_time: existing?.login_time || new Date().toLocaleString(),
    status: "active",
  };

  saveSessions(sessions);

  return { ok: true, sessionId, sessions };
}

export function startUserSession(user) {
  const auth = {
    username: user.username,
    role: user.role,
    sessionId: createSessionId(user.username),
  };

  setAuthSession(auth);
  ensureActiveSession(auth);

  return auth;
}

export function terminateSession(sessionId) {
  const sessions = getSessions();
  if (!sessions[sessionId]) return sessions;

  sessions[sessionId] = {
    ...sessions[sessionId],
    status: "terminated",
  };

  saveSessions(sessions);
  return sessions;
}

export function logoutCurrentSession() {
  const auth = getAuthSession();
  if (auth?.sessionId) {
    terminateSession(auth.sessionId);
  }
  clearAuthSession();
}
