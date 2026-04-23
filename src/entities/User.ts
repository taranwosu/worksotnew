import type { EntityConfig } from "../hooks/useEntity";

export const userEntityConfig: EntityConfig = {
  name: "User",
  orderBy: "created_at DESC",
  properties: {
    name: { type: "string", description: "User full name" },
    email: { type: "string", description: "User email" },
    age: { type: "integer", description: "User age" },
    isActive: { type: "string", description: "Active flag", default: "true" },
  },
  required: ["name", "email"],
};
