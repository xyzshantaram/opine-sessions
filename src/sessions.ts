// deno-lint-ignore-file no-explicit-any
import { DB, OpineRequest, OpineResponse, getCookies, Opine } from "./deps.ts";
import { execute, fetchOptional } from "./utils.ts";

export function init(app: Opine) {
    app.set('session', new SqliteSessionStore());
}

export function getClient(req: OpineRequest, res: OpineResponse) {
    let { sid } = getCookies(req.headers);
    const session: SqliteSessionStore = req.app.get('session');

    if (!sid) {
        sid = session.createSession();
        res.cookie('sid', sid, {
            expires: new Date(Date.now() + 864e5),
            httpOnly: true
        });
    }
    return new ClientSession(sid, session);
}

export function destroy(res: OpineResponse, sid: string) {
    res.clearCookie('sid');
    res.app.get('session').drop(sid);
}

class ClientSession {
    sid: string;
    session: SqliteSessionStore;

    constructor(sid: string, session: SqliteSessionStore) {
        this.sid = sid;
        this.session = session;
    }

    get<T>(key: string): T | null {
        return this.session.get<T>(this.sid, key);
    }

    set(key: string, val: any) {
        this.session.set(this.sid, key, val);
    }

    delete(key: string) {
        this.session.delete(this.sid, key);
    }

    clear() {
        this.session.clear(this.sid);
    }

    drop() {
        this.session.drop(this.sid);
    }
}

class SqliteSessionStore {
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

    drop(sid: string) {
        execute(this.db, 'DELETE from sessions where id = ?', sid);
    }
}