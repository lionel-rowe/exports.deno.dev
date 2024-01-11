# `exports.deno.dev`

Import TypeScript directly from front-end JavaScript (via ESM imports). Prepend `https://exports.deno.dev/s/` to a TypeScript URL to import.

TypeScript files are compiled on-the-fly upon first import, then cached. Because of this, versioned permalinks should always be used, as non-versioned URLs are liable to return stale code from the cache.

## Examples

```js
// static
import { parse } from "https://exports.deno.dev/s/https://deno.land/std@0.211.0/jsonc/mod.ts"
import { marked } from "https://exports.deno.dev/s/https://raw.githubusercontent.com/markedjs/marked/9514a93/src/marked.ts"

// dynamic
const { escape } = await import("https://exports.deno.dev/s/https://deno.land/std@0.211.0/html/mod.ts")
const { stringify } = await import("https://exports.deno.dev/s/https://deno.land/std@0.211.0/yaml/mod.ts")
```
