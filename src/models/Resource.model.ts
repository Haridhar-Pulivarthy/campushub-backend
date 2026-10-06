/**
 * Resource model — Mongoose schema and document interface only.
 *
 * Mirrors the `Resource` schema in docs/openapi.yaml. The contract's `id` is
 * provided by MongoDB's `_id` (exposed by Mongoose as the virtual `id` string),
 * so it is not declared as a separate field.
 */
import { Schema, model } from "mongoose";
import type { Model } from "mongoose";

import type { ResourceType } from "../types/reservation.js";

/** Allowed values for Resource.type (OpenAPI enum). */
export const RESOURCE_TYPES: readonly ResourceType[] = [
  "ROOM",
  "EQUIPMENT",
  "LAB",
];

/** Persisted shape of a Resource document. */
export interface IResource {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** Mongoose model type for Resource. */
export type ResourceModel = Model<IResource>;

const resourceSchema = new Schema<IResource, ResourceModel>({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: RESOURCE_TYPES },
  location: { type: String, required: true },
  isAvailable: { type: Boolean, required: true },
});

export const ResourceModel: ResourceModel = model<IResource, ResourceModel>(
  "Resource",
  resourceSchema,
);
