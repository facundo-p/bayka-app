/**
 * Offline login configuration.
 *
 * OFFLINE_LOGIN_EXPIRE: when false, cached credentials never expire
 *   (user can log in offline indefinitely after one successful online login).
 * OFFLINE_LOGIN_DURATION_HS: hours the offline login remains valid
 *   when OFFLINE_LOGIN_EXPIRE is true.
 */
export const OFFLINE_LOGIN_EXPIRE = false;
export const OFFLINE_LOGIN_DURATION_HS = 168; // 1 week
