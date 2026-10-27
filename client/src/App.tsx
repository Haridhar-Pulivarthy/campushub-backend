/**
 * Application shell: resource directory, booking form, and My Bookings.
 *
 * App owns only the cross-component state — the selected resource and a
 * token that tells My Bookings to reload after a booking is created.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import styles from "./App.module.css";
import BookingForm from "./components/BookingForm.tsx";
import ResourceList from "./components/ResourceList.tsx";
import UserReservations from "./components/UserReservations.tsx";
import { CURRENT_USER_ID } from "./config/currentUser.ts";
import type { Resource } from "./types/api.ts";

function App(): ReactElement {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null,
  );
  const [bookingsRefreshToken, setBookingsRefreshToken] = useState<number>(0);

  function handleBooked(): void {
    setBookingsRefreshToken((n: number): number => n + 1);
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>CampusHub</h1>
        <p className={styles.subtitle}>
          Current student: <strong>{CURRENT_USER_ID}</strong>
        </p>
      </header>
      <main className={styles.layout}>
        <div className={styles.directory}>
          <ResourceList
            selectedResourceId={selectedResource?.id ?? null}
            onSelect={setSelectedResource}
          />
        </div>
        <div className={styles.booking}>
          <BookingForm
            resource={selectedResource}
            userId={CURRENT_USER_ID}
            onBooked={handleBooked}
          />
        </div>
        <div className={styles.bookings}>
          <UserReservations
            userId={CURRENT_USER_ID}
            refreshToken={bookingsRefreshToken}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
