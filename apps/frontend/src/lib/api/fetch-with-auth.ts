import { apiRefresh } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { resetChatSocket } from "@/features/chat/socket/chat-socket";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status !== 401) return res;

  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = apiRefresh().then((user) => {
      isRefreshing = false;
      refreshPromise = null;
      return user ? useAuthStore.getState().accessToken : null;
    });
  }

  const newToken = await refreshPromise;
  if (!newToken) {
    useAuthStore.getState().clear();
    resetChatSocket();
    return res;
  }

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${newToken}`,
    },
  });
}
