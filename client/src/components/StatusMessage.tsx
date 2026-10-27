/**
 * A visible status, success, warning, or error message with an optional
 * action button (e.g. Retry). Errors are announced as alerts; everything
 * else as a polite status update.
 */
import type { ReactElement, ReactNode } from "react";

import styles from "./StatusMessage.module.css";

export type StatusKind = "info" | "success" | "warning" | "error";

export interface StatusAction {
  label: string;
  onClick: () => void;
}

export interface StatusMessageProps {
  kind: StatusKind;
  children: ReactNode;
  action?: StatusAction;
}

function StatusMessage({
  kind,
  children,
  action,
}: StatusMessageProps): ReactElement {
  return (
    <div
      className={`${styles.message} ${styles[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <div className={styles.text}>{children}</div>
      {action !== undefined && (
        <button
          type="button"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default StatusMessage;
