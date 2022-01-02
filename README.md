# opine-sessions

Cookie-based sessions module for the
[Opine web framework](https://github.com/cmorten/opine).

(Unafilliated with Opine's maintainers.)

## Usage

### Import the module

```ts
import sessions from "https://deno.land/x/sessions@1.0.0/mod.ts";
```

### Initialise

```ts
const app = opine();
sessions.init(app);
```

By default, this module will use `x/sqlite` to store data in an SQLite database.
However, you can use a storage solution of your choice by passing an instance of
a class that implements the Store interface.

```ts
import sessions from "https://deno.land/x/sessions@1.0.0/mod.ts";
import { Store } from "https://deno.land/x/sessions@1.0.0/mod.ts";

class CustomStore implements Store {
  /* implementation */
}

sessions.init(app, {
  store: new CustomStore(),
});
```

### Using sessions

Get a session object by calling `getClient()` and use its methods:

```ts
app.get("/", (req, res) => {
  const session = sessions.getClient(req, res);
  const name = session.get<string>("name");
  session.set("name", "shantaram");
  session.delete("shantaram");

  session.set("website", "shantaram.xyz");
  session.clear();
});
```

For a more complete example, see [examples/greeting.ts](examples/greeting.ts).

## License

Copyright © 2022 Siddharth Singh, under the terms of the MIT License.
