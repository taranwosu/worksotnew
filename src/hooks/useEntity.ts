import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFlexibleRepository,
  type EntityRecord,
} from "../repositories/flexibleEntityRepository";

export type EntityField = {
  type: "string" | "number" | "integer";
  format?: "date" | string;
  description?: string;
  enum?: string[];
  default?: unknown;
};

export type EntityConfig = {
  name: string;
  entityType?: string;
  orderBy?: string;
  properties: Record<string, EntityField>;
  required?: string[];
};

export const useEntity = <T extends EntityRecord>(config: EntityConfig) => {
  const repo = useMemo(
    () =>
      createFlexibleRepository({
        entityType: config.entityType || config.name,
        orderBy: config.orderBy,
      }),
    [config.entityType, config.name, config.orderBy]
  );

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await repo.list<T>());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  const create = useCallback(
    async (data: Omit<T, "id" | "created_at" | "updated_at">) => {
      await repo.create<T>(data);
      await reload();
    },
    [repo, reload]
  );

  const update = useCallback(
    async (id: string | number, data: Partial<T>) => {
      await repo.update<T>(id, data);
      await reload();
    },
    [repo, reload]
  );

  const remove = useCallback(
    async (id: string | number) => {
      await repo.remove(id);
      await reload();
    },
    [repo, reload]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload, create, update, remove, config };
};
