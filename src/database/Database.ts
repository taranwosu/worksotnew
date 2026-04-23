/* eslint-disable @typescript-eslint/no-explicit-any */
import { turso } from "./client";

export class Database {
  async query(sql: string, params?: any[]): Promise<any[]> {
    try {
      const result = await turso.execute({
        sql,
        args: params || [],
      });
      return result.rows;
    } catch (error) {
      console.error("[Database] Query error:", error);
      throw error;
    }
  }

  async run(sql: string, params?: any[]): Promise<void> {
    try {
      await turso.execute({
        sql,
        args: params || [],
      });
    } catch (error) {
      console.error("[Database] Run error:", error);
      throw error;
    }
  }

  async execute(
    sql: string,
    params?: any[]
  ): Promise<{ lastInsertRowid: bigint | undefined }> {
    try {
      const result = await turso.execute({
        sql,
        args: params || [],
      });
      return { lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      console.error("[Database] Execute error:", error);
      throw error;
    }
  }
}

export const db = new Database();
