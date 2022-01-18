# opine-sessions

Cookie-based sessions module for the
[Opine web framework](https://github.com/cmorten/opine).

(Unafilliated with Opine's maintainers.)

## Usage

### Import the module

```ts
import sessions from "https://deno.land/x/opine_sessions@2.0.1/mod.ts";
```

### Initialise

```ts
const app = opine();
sessions.init(app);
```

#### Experimental async store

By default, this module will use [`x/sqlite`](https://deno.land/x/sqlite) to
store data in an SQLite database. `x/sqlite` does db operations on the main
thread - this is not ideal for web applications with large amounts of traffic.

This module ships with an experimental async store based on
[worker_sqlite](https://deno.land/x/worker_sqlite) that operates by wrapping
`x/sqlite` in a Worker thread. You can use it by doing:

```ts
import sessions from "https://deno.land/x/opine_sessions@2.0.1/mod.ts";
const store = new sessions.AsyncSqliteStore();
await store.init(); // you MUST do this before using sessions

sessions.init(app, { store });
```

#### Other storage methods

Additionally, you can use a storage solution of your choice by passing an
instance of a class that implements the Store interface.

```ts
import sessions from "https://deno.land/x/opine_sessions@2.0.1/mod.ts";
import { Store } from "https://deno.land/x/opine_sessions@2.0.1/mod.ts";

class CustomStore implements Store {
  /* implementation */
}

const store = new CustomStore();
sessions.init(app, { store });
```

### Using sessions

Get a session object by calling `getClient()` and use its methods:

```ts
app.get("/", async (req, res) => {
  const session = await sessions.getClient(req, res);
  const name = await session.get<string>("name");
  await session.set("name", "shantaram");
  await session.delete("shantaram");

  await session.set("website", "shantaram.xyz");
  session.clear();
});
```

For a more complete example, see the [examples](examples/).

## License

Copyright © 2022 Siddharth Singh, under the terms of the MIT License.
