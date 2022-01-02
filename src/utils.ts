import { DB, Row } from "./deps.ts";

export function execute(db: DB, query: string, ...params: (string | boolean | number)[]) {
    db.query(query, params);
}

export function fetchOptional<T extends Row>(db: DB, query: string, ...params: (string | boolean | number)[]): T | null {
    const result = db.query<T>(query, params);
    if (result.length === 0) return null;
    return result[0];
}
