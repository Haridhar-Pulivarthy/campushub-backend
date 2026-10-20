/**
 * Resource service — business logic and data access for campus resources.
 *
 * The only layer that queries the Resource model. Returns plain API-shaped
 * data (per docs/openapi.yaml) to controllers. No HTTP concerns live here.
 */
import type { Types } from "mongoose";

import {
  RESOURCE_TYPES,
  ResourceModel,
  type IResource,
} from "../models/Resource.model.js";
import type { Resource, ResourceType } from "../types/reservation.js";

/** A lean Resource document as returned by Mongoose queries. */
type LeanResource = IResource & { _id: Types.ObjectId };

/** Filter accepted by listResources queries. */
export type ResourceFilter = Partial<Pick<IResource, "type" | "isAvailable">>;

/** Type guard for the ResourceType enum. */
export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

/**
 * Parse an isAvailable filter value.
 * @returns true/false for "true"/"false"; undefined for any other value.
 */
export function parseAvailability(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

/** Map a stored Resource document to the API `Resource` shape. */
function toResource(doc: LeanResource): Resource {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    location: doc.location,
    isAvailable: doc.isAvailable,
  };
}

/**
 * Return all resources, optionally filtered by type and/or availability.
 * @param filter - Optional filters; an empty filter returns every resource.
 */
export async function listResources(
  filter: ResourceFilter = {},
): Promise<Resource[]> {
  const docs = await ResourceModel.find(filter).lean<LeanResource[]>().exec();
  return docs.map(toResource);
}
