// TODO: use latest version (currently breaks on Deno Deploy)
import { transpile } from './deno_emit/js/mod.ts'
import { regExpEscape } from '@li/regexp-escape-polyfill'
import { get, set } from '@kitsonk/kv-toolbox/blob'
import { JS_HEADERS, JSON_HEADERS, ONE_YEAR_IN_MILLISECONDS, PATH_PREFIX } from './constants.ts'

const kv = await Deno.openKv()

const oldPrefixes = [['v1'], ['files'], ['v2']]
// delete old versions
for (const prefix of oldPrefixes) {
	for await (const entry of kv.list({ prefix })) {
		await kv.delete(entry.key)
	}
}

const CURRENT_VERSION = 'v3'
const KEY_PREFIX = [CURRENT_VERSION, 'files'] as const

const cache = {
	async get(href: string) {
		return (await get(kv, [...KEY_PREFIX, href], { consistency: 'strong' })).value
	},
	async set(href: string, content: string) {
		return await set(kv, [...KEY_PREFIX, href], new TextEncoder().encode(content), {
			expireIn: ONE_YEAR_IN_MILLISECONDS,
		})
	},
}

// TODO: remove this horrible hack
function postProcess(jsInput: Uint8Array | string) {
	const js = typeof jsInput === 'string' ? jsInput : new TextDecoder().decode(jsInput)

	return js.replaceAll(
		new RegExp(
			String
				.raw`(?<before>(^|[\n;])import\s+[\w$]+\s+from\s+(?<quot>['"])[^'"]+(\k<quot>)\s+)assert(?<after>\s+\{)`,
			'gu',
		),
		'$<before>with$<after>',
	)
}

export async function getContent(scriptUrl: URL, reqUrl: URL) {
	if (scriptUrl.pathname.endsWith('.json')) {
		const res = await fetch(scriptUrl)
		const headers = new Headers(res.headers)

		for (const [k, v] of Object.entries(JSON_HEADERS)) {
			headers.set(k, v)
		}

		return new Response(res.body, {
			status: res.status,
			headers,
		})
	}

	const cached = await cache.get(scriptUrl.href)
	if (cached != null) {
		return new Response(postProcess(cached), { headers: JS_HEADERS })
	}

	// // ?edd-import-map=<IMPORT_MAP_URL>
	// const importMap =
	// 	// undefined;
	// 	'data:application/json;base64,ewoJImltcG9ydHMiOiB7CgkJImNoZWVyaW8iOiAiaHR0cHM6Ly9lc20uc2gvdjEzMS9jaGVlcmlvQDAuMjIuMCIsCgkJImNsaWZmeS8iOiAiaHR0cHM6Ly9kZW5vLmxhbmQveC9jbGlmZnlAdjEuMC4wLXJjLjMvIiwKCQkic3RkLyI6ICJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4yMDguMC8iLAoJCSJ6aXBqcyI6ICJodHRwczovL2VzbS5zaC92MTM1L0B6aXAuanMvemlwLmpzQDIuNy4zNCIKCX0KfQ=='

	const result = await transpile(scriptUrl, {
		// importMap,
		cache: false,
	})

	const groupKeys = ['quot', 'href'] as const
	type GroupKey = typeof groupKeys[number]
	const gk = Object.fromEntries(groupKeys.map((k) => [k, k])) as { [k in GroupKey]: k }
	const urlMatcher = new RegExp(
		String.raw`(?<${gk.quot}>['"])(?<${gk.href}>${
			[...result.keys()].map((x) => {
				try {
					const u = new URL(x)

					return `[^'"]*${regExpEscape(u.href.slice(u.origin.length))}`
				} catch {
					return null
				}
			}).filter(Boolean).join('|')
		})\k<${gk.quot}>`,
		'gu',
	)

	await Promise.all([...result.entries()].map(([resultHref, content]) => {
		const code = `/// <reference types="${resultHref}" />\n\n${
			content
				.replaceAll(urlMatcher, (...args) => {
					const groups = args.find((x) => typeof x === 'object') as { [k in GroupKey]: string }
					const replacement =
						new URL(`./${new URL(groups.href, resultHref)}`, new URL(PATH_PREFIX, reqUrl).href).href

					return `${groups.quot}${replacement}${groups.quot}`
				})
		}`

		return cache.set(resultHref, code)
	}))

	return new Response(postProcess((await cache.get(scriptUrl.href))!), { headers: JS_HEADERS })
}
