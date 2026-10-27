/**
 * Typed Vite environment variables. Declaring them here replaces the
 * `any`-typed index signature from vite/client for these keys.
 */
interface ImportMetaEnv {
  /** Student id used as `userId` for bookings; see src/config/currentUser.ts. */
  readonly VITE_CAMPUSHUB_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
