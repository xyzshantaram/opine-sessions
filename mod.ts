import { init, destroy, getClient, AsyncSqliteStore } from "./src/sessions.ts";

export type { Store } from './src/sessions.ts';

export { init, destroy, getClient, AsyncSqliteStore };
export default { init, destroy, getClient, AsyncSqliteStore };