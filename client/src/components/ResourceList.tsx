/**
 * Resource directory: type filter, resource cards, and selection of an
 * available resource for booking.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { useResources } from "../hooks/useResources.ts";
import type { Resource, ResourceType } from "../types/api.ts";
import { RESOURCE_TYPE_LABELS } from "../utils/labels.ts";
import styles from "./ResourceList.module.css";
import StatusMessage from "./StatusMessage.tsx";

export interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

type TypeFilter = ResourceType | "ALL";

const FILTERS: readonly { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ROOM", label: RESOURCE_TYPE_LABELS.ROOM },
  { value: "EQUIPMENT", label: RESOURCE_TYPE_LABELS.EQUIPMENT },
  { value: "LAB", label: RESOURCE_TYPE_LABELS.LAB },
];

interface ResourceCardProps {
  resource: Resource;
  isSelected: boolean;
  onSelect: (resource: Resource) => void;
}

function ResourceCard({
  resource,
  isSelected,
  onSelect,
}: ResourceCardProps): ReactElement {
  const headingId = `resource-${resource.id}-name`;
  const cardClass = [
    styles.card,
    isSelected ? styles.selected : "",
    resource.isAvailable ? "" : styles.unavailable,
  ].join(" ");

  return (
    <li className={cardClass}>
      <article aria-labelledby={headingId} className={styles.cardBody}>
        <h3 id={headingId} className={styles.name}>
          {resource.name}
        </h3>
        <p className={styles.meta}>
          <span className={styles.typeTag}>
            {RESOURCE_TYPE_LABELS[resource.type]}
          </span>
          <span>{resource.location}</span>
        </p>
        <p
          className={
            resource.isAvailable
              ? styles.availableBadge
              : styles.unavailableBadge
          }
        >
          {resource.isAvailable ? "Available for booking" : "Unavailable"}
        </p>
        <button
          type="button"
          className={styles.selectButton}
          disabled={!resource.isAvailable}
          aria-pressed={resource.isAvailable ? isSelected : undefined}
          onClick={(): void => {
            onSelect(resource);
          }}
        >
          {!resource.isAvailable
            ? "Cannot be booked"
            : isSelected
              ? "Selected"
              : "Select for booking"}
        </button>
      </article>
    </li>
  );
}

function ResourceList({
  selectedResourceId,
  onSelect,
}: ResourceListProps): ReactElement {
  const [filter, setFilter] = useState<TypeFilter>("ALL");
  const { state, retry } = useResources(filter === "ALL" ? undefined : filter);

  function handleSelect(resource: Resource): void {
    // Unavailable resources are never selectable, even if the button's
    // disabled state were bypassed.
    if (resource.isAvailable) {
      onSelect(resource);
    }
  }

  let content: ReactElement;
  if (state.status === "loading") {
    content = <StatusMessage kind="info">Loading resources…</StatusMessage>;
  } else if (state.status === "error") {
    content = (
      <StatusMessage kind="error" action={{ label: "Retry", onClick: retry }}>
        Could not load resources. {state.message}
      </StatusMessage>
    );
  } else if (state.resources.length === 0) {
    content = (
      <StatusMessage kind="info">
        {filter === "ALL"
          ? "No resources are listed yet."
          : `No ${RESOURCE_TYPE_LABELS[filter].toLowerCase()} resources found.`}
      </StatusMessage>
    );
  } else {
    content = (
      <ul className={styles.grid} aria-label="Resources">
        {state.resources.map((resource: Resource): ReactElement => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            isSelected={resource.id === selectedResourceId}
            onSelect={handleSelect}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="directory-heading">
      <h2 id="directory-heading" className={styles.heading}>
        Resource directory
      </h2>
      <div className={styles.filters} role="group" aria-label="Filter by type">
        {FILTERS.map(({ value, label }): ReactElement => (
          <button
            key={value}
            type="button"
            className={styles.filterButton}
            aria-pressed={filter === value}
            onClick={(): void => {
              setFilter(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        “Available for booking” means the resource accepts reservations. A
        specific time may still be taken — the booking form checks that when you
        submit.
      </p>
      {content}
    </section>
  );
}

export default ResourceList;
