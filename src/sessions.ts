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
    createSession: () => Promise<string>;
    /** 
     * Get the session contents as a JavaScript object.
    */
    getSession: (sid: string) => Promise<Record<string, any>>;
    /**
     * Get the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key of the value to retrieve.
    */
    get<T>(sid: string, key: string): Promise<T | null>;
    /**
     * Set the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key to set.
     * @param val the value to set.
    */
    set: (sid: string, key: string, val: any) => Promise<void>;
    /**
     * Delete the value associated with `key` for the session `sid`.
     * @param sid A unique session id returned from createSession.
     * @param key The key to delete.
    */
    delete: (sid: string, key: string) => Promise<void>;
    /**
     * Clear all session variables associated with a `sid`.
     * @param sid A unique session id returned from createSession.
    */
    clear: (sid: string) => Promise<void>;
}

/**
 * Initialise sessions for the given Opine app.
 * @param app The app you want to use sessions with.
 * @param options An options object.
 * @param options.store A store to use instead of the default SQLite store.
 */
export function init(app: Opine, options?: {
    store: Store
}) {
    app.set('session', options?.store || new SqliteStore());
}

export interface SessionOptions {
    /**
     * A Date object denoting the expiry of the session identifier cookie. Defaults to 7 days from creation.
    */
    expires?: Date,
    /**
     * Whether the cookie should be accessible from JS. It is recommended to set this to true.
    */
    httpOnly?: boolean,
    /**
     * The same-site policy for the session cookie. Set to Strict by default.
    */
    sameSite?: "Lax" | "Strict" | "None"
}

/**
 * 
 * @param req The request object from your route handler
 * @param res The response object from your route handler
 * @param options Extra options for the session cookie
 * @returns a session object
 */
export async function getClient(req: OpineRequest, res: OpineResponse, options?: SessionOptions) {
    const store: Store = req.app.get('session');
    let { sid } = getCookies(req.headers);

    if (!sid) {
        sid = await store.createSession();
        res.cookie('sid', sid, {
            expires: options?.expires || new Date(Date.now() + 7 * 864e5),
            httpOnly: options?.httpOnly || true,
            sameSite: options?.sameSite || "Strict"
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
    async get<T>(key: string) {
        return await this.store.get<T>(this.sid, key);
    }

    /**
     * Set the value associated with `key` to be `val`.
     * @param key The key to modify.
     * @param val The value to set.
     */
    async set(key: string, val: any) {
        await this.store.set(this.sid, key, val);
    }

    /**
     * Delete a value from the store.
     * @param key The key to delete.
     */
    async delete(key: string) {
        await this.store.delete(this.sid, key);
    }

    /**
     * Clear all session variables for this store.
     */
    async clear() {
        await this.store.clear(this.sid);
    }
}

class SqliteStore implements Store {
    db: DB;

    constructor() {
        this.db = new DB('./sessions.db');
        execute(this.db, 'CREATE TABLE IF NOT EXISTS sessions(id TEXT UNIQUE NOT NULL, data TEXT not null);');
    }

    createSession() {
        try {
            const id = crypto.randomUUID();
            execute(this.db, 'insert into sessions(id, data) VALUES(?, ?);', id, '{}');
            return Promise.resolve(id);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getSession(sid: string) {
        try {
            const data = fetchOptional<string[]>(this.db, 'SELECT data FROM sessions WHERE id = ?', sid);
            let parsed: Record<string, any>;
            if (data) {
                parsed = JSON.parse(data[0] || '{}');
            }
            else {
                execute(this.db, 'INSERT INTO sessions(id, data) VALUES(?, ?);', sid, '{}');
                parsed = {};
            }
            return Promise.resolve(parsed);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    persist(sid: string, data: Record<string, any>) {
        execute(this.db, 'UPDATE sessions SET data = ? WHERE id = ?;', JSON.stringify(data), sid);
    }

    async get<T>(sid: string, key: string): Promise<T | null> {
        const session = await this.getSession(sid);
        const val: T | null = session[key] || null;
        return Promise.resolve(val);
    }

    async set(sid: string, key: string, val: any) {
        const session = await this.getSession(sid);
        session[key] = val;
        this.persist(sid, session);
    }

    async delete(sid: string, key: string) {
        const session = await this.getSession(sid);
        delete session[key];
        this.persist(sid, session);
    }

    clear(sid: string) {
        try {
            execute(this.db, 'UPDATE sessions SET data = ? where id = ?', '{}', sid);
            return Promise.resolve();
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
}