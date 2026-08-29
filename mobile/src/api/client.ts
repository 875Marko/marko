import Constants from 'expo-constants';

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:8000/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

/** AuthContext calls this after login/signup/logout/boot so every request
 * downstream carries (or drops) the Bearer token without a circular import. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).detail)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path, { method: 'GET' });
const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload !== undefined ? JSON.stringify(payload) : undefined });

// ---------- Types ----------

export interface User {
  user_id: string;
  username: string;
  name: string;
  picture: string | null;
  total_points: number;
  scan_count: number;
  friends?: string[];
  created_at: string;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CompletedAchievement {
  id: string;
  title: string;
  period: 'daily' | 'weekly';
  bonus: number;
}

export interface ScanResult {
  scan_id: string;
  user_id: string;
  make: string;
  model: string;
  year: string | null;
  color: string | null;
  body_type: string;
  tags: string[];
  country_origin: string | null;
  production_years: string | null;
  engine: string | null;
  top_speed_kmh: number;
  fun_fact: string | null;
  rarity: Rarity;
  points: number;
  reason: string;
  image_base64: string;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
  completed_achievements: CompletedAchievement[];
  bonus_points: number;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  period: 'daily' | 'weekly';
  bonus: number;
  completed: boolean;
  completed_at: string | null;
}

export interface AtlasCountry {
  country: string;
  code: string | null;
  count: number;
  last_at: string;
}

export interface GarageResponse {
  user: User;
  scans: ScanResult[];
  total: number;
  limit: number;
  skip: number;
}

export interface SpotWinner {
  week_key: string;
  scan_id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  make: string;
  model: string;
  rarity: Rarity;
  points: number;
  image_base64: string | null;
  country: string | null;
  created_at: string;
}

export interface ProfileStats {
  rarity_breakdown: Record<Rarity, number>;
  top_make: { name: string; count: number } | null;
  top_body: { name: string; count: number } | null;
  top_color: { name: string; count: number } | null;
  top_origin: { name: string; count: number } | null;
  countries_count: number;
  badge_count: number;
  achievement_count: number;
  best_scan: { make: string; model: string; rarity: Rarity; year: string | null; points: number } | null;
  bonus_points_total: number;
  scans_remaining_today: number;
  daily_limit: number;
  days_since_joined: number | null;
}

// ---------- Auth ----------

export const AuthApi = {
  register: (username: string, password: string, display_name?: string) =>
    post<{ session_token: string; user: User }>('/auth/register', { username, password, display_name }),
  login: (username: string, password: string) =>
    post<{ session_token: string; user: User }>('/auth/login', { username, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post<{ ok: boolean }>('/auth/logout'),
};

// ---------- Scans / Garage ----------

export const ScanApi = {
  scan: (payload: {
    image_base64: string;
    latitude?: number | null;
    longitude?: number | null;
    country?: string | null;
    country_code?: string | null;
    region?: string | null;
    city?: string | null;
  }) => post<ScanResult>('/scan', payload),
  garage: (limit = 30, skip = 0) => get<GarageResponse>(`/garage?limit=${limit}&skip=${skip}`),
};

// ---------- Achievements / Atlas / Spot of the Week ----------

export const AchievementsApi = {
  list: () => get<{ achievements: Achievement[] }>('/achievements'),
};

export const AtlasApi = {
  get: () =>
    get<{
      countries: AtlasCountry[];
      country_count: number;
      located_count: number;
      total_scans: number;
      recent: ScanResult[];
    }>('/atlas'),
};

export const SpotOfWeekApi = {
  get: () =>
    get<{ current_leader: SpotWinner | null; last_week_winner: SpotWinner | null; my_badges: SpotWinner[] }>(
      '/spot-of-the-week'
    ),
};

// ---------- Leaderboards / Friends ----------

export const LeaderboardApi = {
  global: () => get<{ users: User[] }>('/leaderboard/global'),
  friends: () => get<{ users: User[] }>('/leaderboard/friends'),
};

export const FriendsApi = {
  add: (friend_username: string) => post<{ ok: boolean; friend: User }>('/friends/add', { friend_username }),
  remove: (friend_username: string) => post<{ ok: boolean }>('/friends/remove', { friend_username }),
  addById: (user_id: string) => post<{ ok: boolean; friend: User }>('/friends/add_by_id', { user_id }),
  removeById: (user_id: string) => post<{ ok: boolean }>('/friends/remove_by_id', { user_id }),
};

// ---------- Discover / Country / Profile ----------

export const DiscoverApi = {
  list: () => get<{ spots: (ScanResult & { hunter_username: string | null; hunter_name: string | null })[] }>(
    '/discover'
  ),
  country: (code: string) =>
    get<{
      country: string | null;
      country_code: string;
      total: number;
      mine: number;
      hunters: number;
      spots: (ScanResult & { hunter_username: string | null; is_mine: boolean })[];
    }>(`/country/${encodeURIComponent(code)}`),
};

export const ProfileApi = {
  stats: () => get<ProfileStats>('/profile/stats'),
  public: (userId: string) =>
    get<{
      user_id: string;
      username: string | null;
      name: string | null;
      picture: string | null;
      total_points: number;
      scan_count: number;
      countries_count: number;
      badge_count: number;
      top_make: { name: string; count: number } | null;
      recent: Partial<ScanResult>[];
      is_friend: boolean;
      is_self: boolean;
    }>(`/profile/public/${encodeURIComponent(userId)}`),
};
