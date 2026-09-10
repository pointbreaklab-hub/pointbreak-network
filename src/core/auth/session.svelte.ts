import { browser } from '$app/environment';

const TOKEN_KEY = 'pb.token';
const LOGIN_KEY = 'pb.login';

export interface Session {
  token: string;
  github_login: string;
}

/**
 * Reactive session state. Persisted in localStorage because there is no server
 * to hold one. Sign-out is a local delete, and the token is the user's own.
 */
class SessionStore {
  current = $state<Session | null>(null);

  constructor() {
    if (!browser) return;
    const token = localStorage.getItem(TOKEN_KEY);
    const github_login = localStorage.getItem(LOGIN_KEY);
    if (token && github_login) this.current = { token, github_login };
  }

  signIn(session: Session) {
    this.current = session;
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(LOGIN_KEY, session.github_login);
  }

  signOut() {
    this.current = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
  }

  get isAuthenticated(): boolean {
    return this.current !== null;
  }
}

export const session = new SessionStore();
