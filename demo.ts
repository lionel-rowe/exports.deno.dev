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
			<title>exports.deno.dev</title>
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
	const jsUrlPrefix = `${globalThis.location.origin}${pathPrefix}`

	async function getModule(tsUrl: string) {
		const js = `${jsUrlPrefix}${tsUrl}`

		return { ts: tsUrl, js, mod: await import(js) }
	}

	const [$yaml, $jsonc, $html, $marked] = await Promise.all([
		`${denoStdRoot}/yaml/mod.ts`,
		`${denoStdRoot}/jsonc/mod.ts`,
		`${denoStdRoot}/html/mod.ts`,
		'https://raw.githubusercontent.com/markedjs/marked/9514a93/src/marked.ts',
	].map(getModule))

	const { marked } = $marked.mod

	const renderer = new marked.Renderer()

	renderer.link = (href: string, title: string, text: string) => {
		const isExternal = new URL(href, globalThis.location.href).origin !== globalThis.location.origin
		return `<a href="${href}"${title ? ` title="${title}"` : ''}${isExternal ? ' target="_blank"' : ''}>${text}</a>`
	}

	marked.setOptions({ renderer })

	const data = $jsonc.mod.parse(jsoncSource)
	const output = $yaml.mod.stringify(data, { indent: 4 })

	target.innerHTML = marked(
		`
# ${'`exports.deno.dev`'}

Import TypeScript directly from front-end JavaScript (via ESM imports). Prepend ${
			'`' + jsUrlPrefix + '`'
		} to a TypeScript URL to import.

TypeScript files are compiled on-the-fly upon first import, then cached. Because of this, versioned permalinks should always be used, as non-versioned URLs are liable to return stale code from the cache.

## Examples

${'```js'}
// static
import * as jsonc from '${$jsonc.js}'
import { marked } from '${$marked.js}'

// dynamic
const html = await import('${$html.js}')
const yaml = await import('${$yaml.js}')
${'```'}

## Demo

Converting JSONC to YAML, using ${'`deno_std`'}’s [${'`jsonc`'}](${$jsonc.ts}) and [${'`yaml`'}](${$yaml.ts}) modules, along with [${'`html`'}](${$html.ts}) for sanitization.

<pre><code class="language-yaml">${$html.mod.escape(output)}</code></pre>
`,
	)
}
