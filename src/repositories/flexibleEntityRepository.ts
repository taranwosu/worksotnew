/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../database/Database";

export type EntityRecord = Record<string, unknown> & { id?: number | string };

export type RepositoryOptions = {
  entityType: string;
  orderBy?: string;
};

/**
 * Create a repository for managing entities in the flexible single-table design
 * All entities are stored in the 'entities' table with their type and JSON data
 *
 * IMPORTANT: Sorting is done CLIENT-SIDE after fetching data
 * - Entity properties are stored in a JSON 'data' column, not as separate DB columns
 * - The orderBy option can reference ANY field (including JSON fields like 'order_position', 'priority', etc.)
 * - Sorting happens in JavaScript after parsing JSON, not in SQL
 * - This allows flexible ordering without schema changes
 * - Works well for small-to-medium datasets (<1000 records per entity type)
 */
export const createFlexibleRepository = (options: RepositoryOptions) => {
  const { entityType, orderBy } = options;

  const list = async <T extends EntityRecord>(): Promise<T[]> => {
    const rows = await db.query(
      `SELECT id, data, created_at, updated_at
       FROM entities
       WHERE entity_type = ?`,
      [entityType]
    );

    const items = rows.map((row) => ({
      id: row.id,
      ...(JSON.parse(row.data as string) as object),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as unknown as T[];

    if (orderBy) {
      return sortItems(items, orderBy);
    }

    return items;
  };

  const sortItems = <T extends EntityRecord>(
    items: T[],
    orderBy: string
  ): T[] => {
    const sortClauses = orderBy.split(",").map((clause) => {
      const parts = clause.trim().split(/\s+/);
      return {
        field: parts[0],
        direction: parts[1]?.toUpperCase() === "DESC" ? "DESC" : "ASC",
      };
    });

    return [...items].sort((a, b) => {
      for (const { field, direction } of sortClauses) {
        const aVal = (a as any)[field];
        const bVal = (b as any)[field];

        if (aVal === bVal) continue;

        const comparison = aVal < bVal ? -1 : 1;
        return direction === "DESC" ? -comparison : comparison;
      }
      return 0;
    });
  };

  const get = async <T extends EntityRecord>(
    id: string | number
  ): Promise<T | null> => {
    const rows = await db.query(
      `SELECT id, data, created_at, updated_at
       FROM entities
       WHERE entity_type = ? AND id = ?`,
      [entityType, id]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      ...(JSON.parse(row.data as string) as object),
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as unknown as T;
  };

  const create = async <T extends EntityRecord>(
    data: Omit<T, "id" | "created_at" | "updated_at">
  ): Promise<T> => {
    const dataJson = JSON.stringify(data);
    const result = await db.execute(
      `INSERT INTO entities (entity_type, data) VALUES (?, ?)`,
      [entityType, dataJson]
    );

    const id = Number(result.lastInsertRowid);
    return (await get<T>(id)) as T;
  };

  const update = async <T extends EntityRecord>(
    id: string | number,
    data: Partial<T>
  ): Promise<void> => {
    // Get existing data
    const existing = await get<T>(id);
    if (!existing) throw new Error(`Entity ${id} not found`);

    // Merge with new data (exclude metadata fields)
    const { id: _, created_at, updated_at, ...existingData } = existing as any;
    const merged = { ...existingData, ...data };
    const dataJson = JSON.stringify(merged);

    await db.run(
      `UPDATE entities
       SET data = ?, updated_at = CURRENT_TIMESTAMP
       WHERE entity_type = ? AND id = ?`,
      [dataJson, entityType, id]
    );
  };

  const remove = async (id: string | number): Promise<void> => {
    await db.run(`DELETE FROM entities WHERE entity_type = ? AND id = ?`, [
      entityType,
      id,
    ]);
  };

  const count = async (): Promise<number> => {
    const rows = await db.query(
      `SELECT COUNT(*) as count FROM entities WHERE entity_type = ?`,
      [entityType]
    );
    return (rows[0]?.count as number) ?? 0;
  };

  const findWhere = async <T extends EntityRecord>(
    conditions: Record<string, unknown>
  ): Promise<T[]> => {
    // Load all entities of this type and filter in-memory
    // For better performance with large datasets, consider using json_extract in WHERE clause
    const all = await list<T>();
    return all.filter((item) => {
      return Object.entries(conditions).every(([key, value]) => {
        return (item as any)[key] === value;
      });
    });
  };

  const findOne = async <T extends EntityRecord>(
    conditions: Record<string, unknown>
  ): Promise<T | null> => {
    const rows = await findWhere<T>(conditions);
    return rows[0] ?? null;
  };

  return { list, get, create, update, remove, count, findWhere, findOne };
};
