import { transpile } from 'https://deno.land/x/emit@0.24.0/mod.ts'
import { escape } from 'https://deno.land/std@0.211.0/regexp/escape.ts'
import { get, set } from 'https://deno.land/x/kv_toolbox@0.0.6/blob.ts'
import { JS_HEADERS, JSON_HEADERS, ONE_YEAR_IN_MILLISECONDS, PATH_PREFIX } from './constants.ts'

const kv = await Deno.openKv()
const version = 'v1'
const keyPrefix = ['files', version] as const

const cache = {
	get(href: string) {
		return get(kv, [...keyPrefix, href], { consistency: 'strong' })
	},
	set(href: string, content: string) {
		return set(kv, [...keyPrefix, href], new TextEncoder().encode(content), {
			expireIn: ONE_YEAR_IN_MILLISECONDS,
		})
	},
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
		return new Response(cached, { headers: JS_HEADERS })
	}

	const result = await transpile(scriptUrl, {})

	const groupKeys = ['quot', 'href'] as const
	type GroupKey = typeof groupKeys[number]
	const gk = Object.fromEntries(groupKeys.map((k) => [k, k])) as { [k in GroupKey]: k }
	const urlMatcher = new RegExp(
		String.raw`(?<${gk.quot}>['"])(?<${gk.href}>${
			[...result.keys()].map((x) => escape(x)).join('|')
		})\k<${gk.quot}>`,
		'gu',
	)

	await Promise.all([...result.entries()].map(([href, content]) => {
		const code = `/// <reference types="${href}" />\n\n${
			content
				.replaceAll(urlMatcher, (...args) => {
					const groups = args.find((x) => typeof x === 'object') as { [k in GroupKey]: string }
					const replacement = `${groups.quot}${
						new URL(`./${groups.href}`, new URL(PATH_PREFIX, reqUrl).href).href
					}${groups.quot}`

					return replacement
				})
		}`

		return cache.set(href, code)
	}))

	return new Response((await cache.get(scriptUrl.href))!, { headers: JS_HEADERS })
}
