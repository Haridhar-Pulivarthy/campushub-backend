/** Text helpers shared by the auto-heal scripts. */

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Removes terminal color codes (Jest colors its output in CI). */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "");
}
