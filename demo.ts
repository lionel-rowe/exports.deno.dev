/// <reference lib="dom" />

import { PATH_PREFIX } from './constants.ts'

const denoJsonc = await Deno.readTextFile('./deno.jsonc')

const script = `
${demo}

${demo.name}(${JSON.stringify([PATH_PREFIX, denoJsonc]).slice(1, -1)})
`

export const demoPageHtml = `
	<!DOCTYPE html>
	<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>Demo</title>
		</head>
		<body>
			<div id="target">Loading...</div>
			<script type="module">${script}</script>
		</body>
	</html>
`

async function demo(pathPrefix: string, jsoncSource: string) {
	const target = document.querySelector('#target')!

	const denoStdRoot = 'https://deno.land/std@0.211.0'

	function getUrls(tsUrl: string) {
		const compiledUrl = `${globalThis.location.origin}${pathPrefix}${tsUrl}`

		return { tsUrl, compiledUrl }
	}

	const yaml = getUrls(`${denoStdRoot}/yaml/mod.ts`)
	const jsonc = getUrls(`${denoStdRoot}/jsonc/mod.ts`)
	const html = getUrls(`${denoStdRoot}/html/mod.ts`)
	const m = getUrls('https://raw.githubusercontent.com/markedjs/marked/9514a93/src/marked.ts')

	const { stringify } = await import(yaml.compiledUrl)
	const { parse } = await import(jsonc.compiledUrl)
	const { escape } = await import(html.compiledUrl)
	const { marked } = await import(m.compiledUrl)

	const renderer = new marked.Renderer()

	renderer.link = (href: string, title: string, text: string) => {
		const isExternal = new URL(href, globalThis.location.href).origin !== globalThis.location.origin
		return `<a href="${href}"${title ? ` title="${title}"` : ''}${isExternal ? ' target="_blank"' : ''}>${text}</a>`
	}

	marked.setOptions({ renderer })

	const data = parse(jsoncSource)
	const output = stringify(data, { indent: 4 })

	target.innerHTML = marked(
		`
# ${'`exports.deno.dev`'}

Import TypeScript directly from front-end JavaScript (via ESM imports). Prepend ${
			'`' + getUrls('').compiledUrl + '`'
		} to a TypeScript URL to import.

TypeScript files are compiled on-the-fly upon first import, then cached. Because of this, versioned permalinks should always be used, as non-versioned URLs are liable to return stale code from the cache.

## Examples

${'```js'}
// static
import { parse } from "${jsonc.compiledUrl}"
import { marked } from "${m.compiledUrl}"

// dynamic
const { escape } = await import("${html.compiledUrl}")
const { stringify } = await import("${yaml.compiledUrl}")
${'```'}

## Demo

Converting JSONC to YAML, using ${'`deno_std`'}’s [${'`jsonc`'}](${jsonc.tsUrl}) and [${'`yaml`'}](${yaml.tsUrl}) modules, along with [${'`html`'}](${html.tsUrl}) for sanitization.

<pre>
${escape(output)}
</pre>
`,
	)
}
