// deno-lint-ignore-file no-explicit-any
import { DB, OpineRequest, OpineResponse, getCookies, Opine } from "./deps.ts";
import { execute, fetchOptional } from "./utils.ts";

/**
 * A generic store. Implement this and pass an instance of it
 * to init() to use your own database solution instead of
 * the default sqlite.
*/
export interface Store {
    /**
     * Create a new session.
     * @returns a unique session id.
    */
    createSession: () => string;
    /** 
     * Get the session contents as a JavaScript object.
    */
    getSession: (sid: string) => Record<string, any>;
    /**
     * Get the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key of the value to retrieve.
    */
    get<T>(sid: string, key: string): T | null;
    /**
     * Set the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key to set.
     * @param val the value to set.
    */
    set: (sid: string, key: string, val: any) => void;
    /**
     * Delete the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key to delete.
    */
    delete: (sid: string, key: string) => void;
    /**
     * Clear all session variables associated with a `sid`.
     * @param sid A unique session id returned from createSession.
    */
    clear: (sid: string) => void;
}

/**
 * 
 * @param app The app you want to use sessions with.
 * @param options An options object.
 * @param options.store A store to use instead of the default SQLite store.
 */
export function init(app: Opine, options?: {
    store: Store
}) {
    app.set('session', options?.store || new SqliteStore());
}

/**
 * 
 * @param req The request object from your route handler
 * @param res The response object from your route handler
 * @returns a session object
 */
export function getClient(req: OpineRequest, res: OpineResponse, options?: {
    expires?: Date,
    httpOnly?: boolean,
    sameSite?: "Lax" | "Strict" | "None"
}) {
    const store: Store = req.app.get('session');
    let { sid } = getCookies(req.headers);

    if (!sid) {
        sid = store.createSession();
        res.cookie('sid', sid, {
            expires: options?.expires || new Date(Date.now() + 7 * 864e5),
            httpOnly: options?.httpOnly || true,
            sameSite: options?.sameSite || "Lax"
        });
    }

    return new ClientSession(sid, store);
}

/** 
 * Destroy the session by clearing its cookie.
 * @param res The response object from your route handler.
*/
export function destroy(res: OpineResponse) {
    res.clearCookie('sid');
}

/**
 * A class representing the session for a particular client. Acts as a key-value data store.
 * **Exported only for type annotations. Do not construct this class directly.**
*/
export class ClientSession {
    private sid: string;
    private store: Store;

    /**
     * ## DO NOT CONSTRUCT THIS CLASS DIRECTLY!
     * **Use `getClient(req, res)`!**
     */
    constructor(sid: string, store: Store) {
        this.sid = sid;
        this.store = store;
    }

    /**
     * Get the value of a session variable.
     * @param key The key associated with the value to retrieve.
     * @returns The requested value, or null.
     */
    get<T>(key: string): T | null {
        return this.store.get<T>(this.sid, key);
    }

    /**
     * Set the value associated with `key` to be `val`.
     * @param key The key to modify.
     * @param val The value to set.
     */
    set(key: string, val: any) {
        this.store.set(this.sid, key, val);
    }

    /**
     * Delete a value from the store.
     * @param key The key to delete.
     */
    delete(key: string) {
        this.store.delete(this.sid, key);
    }

    /**
     * Clear all session variables for this store.
     */
    clear() {
        this.store.clear(this.sid);
    }
}

class SqliteStore implements Store {
    db: DB;

    constructor() {
        this.db = new DB('./sessions.db');
        execute(this.db, 'CREATE TABLE IF NOT EXISTS sessions(id TEXT UNIQUE NOT NULL, data TEXT not null);');
    }

    createSession() {
        const id = crypto.randomUUID();
        execute(this.db, 'insert into sessions(id, data) VALUES(?, ?);', id, '{}');
        return id;
    }

    getSession(sid: string) {
        const data = fetchOptional<string[]>(this.db, 'SELECT data FROM sessions WHERE id = ?', sid);
        let parsed: Record<string, any>;
        if (data) {
            parsed = JSON.parse(data[0] || '{}');
        }
        else {
            execute(this.db, 'INSERT INTO sessions(id, data) VALUES(?, ?);', sid, '{}');
            parsed = {};
        }
        return parsed;
    }

    persist(sid: string, data: Record<string, any>) {
        execute(this.db, 'UPDATE sessions SET data = ? WHERE id = ?;', JSON.stringify(data), sid);
    }

    get<T>(sid: string, key: string): T | null {
        const session = this.getSession(sid);
        return session[key] || null;
    }

    set(sid: string, key: string, val: any) {
        const session = this.getSession(sid);
        session[key] = val;
        this.persist(sid, session);
    }

    delete(sid: string, key: string) {
        const session = this.getSession(sid);
        delete session[key];
        this.persist(sid, session);
    }

    clear(sid: string) {
        execute(this.db, 'UPDATE sessions SET data = ? where id = ?', '{}', sid);
    }
}