import 'https://esm.sh/v131/temporal-polyfill@0.1.1/dist/global.mjs'
import { transpile } from 'https://deno.land/x/emit@0.24.0/mod.ts'
import { escape } from 'https://deno.land/std@0.211.0/regexp/escape.ts'
import { STATUS_CODE, STATUS_TEXT } from 'https://deno.land/std@0.211.0/http/status.ts'
import { get, set } from 'https://deno.land/x/kv_toolbox@0.0.6/blob.ts'

const kv = await Deno.openKv()
const version = 'v1'
const keyPrefix = ['files', version] as const

const ONE_YEAR_IN_MS = Temporal.Duration.from({ years: 1 }).total({
	unit: 'milliseconds',
	relativeTo: new Temporal.Instant(0n).toZonedDateTimeISO('UTC'),
})

const cache = {
	get(href: string) {
		return get(kv, [...keyPrefix, href], { consistency: 'strong' })
	},
	set(href: string, content: string) {
		return set(kv, [...keyPrefix, href], new TextEncoder().encode(content), {
			expireIn: ONE_YEAR_IN_MS,
		})
	},
}

const CHARSET = 'charset=utf-8'
const ContentType = {
	Js: `application/javascript; ${CHARSET}`,
	Json: `application/json; ${CHARSET}`,
} as const

const _headers = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET',
} as const
const jsHeaders = {
	..._headers,
	'Content-Type': ContentType.Js,
} as const
const jsonHeaders = {
	..._headers,
	'Content-Type': ContentType.Json,
} as const

const allowedProtocols = ['http', 'https'].map((x) => `${x}:`)

Deno.serve(async (req: Request) => {
	let url: URL
	const reqUrl = new URL(req.url)
	const pathPrefix = '/s/'

	if (!reqUrl.pathname.startsWith(pathPrefix)) {
		return new Response(JSON.stringify({ error: STATUS_TEXT[STATUS_CODE.NotFound] }), {
			status: STATUS_CODE.NotFound,
			headers: jsonHeaders,
		})
	} else {
		const href = reqUrl.pathname.slice(pathPrefix.length)
		if (href.length < 2) {
			return new Response(JSON.stringify({ error: 'Bad URL' }), {
				status: STATUS_CODE.BadRequest,
				headers: jsonHeaders,
			})
		}

		url = new URL(/^\w+:/.test(href) ? href : `https://${href}`)

		if (!allowedProtocols.includes(url.protocol)) {
			return new Response(
				JSON.stringify({ error: `Protocol '${url.protocol}' not allowed in URL '${url.href}'` }),
				{
					status: STATUS_CODE.BadRequest,
					headers: jsonHeaders,
				},
			)
		}
	}

	try {
		if (url.pathname.endsWith('.json')) {
			const res = await fetch(url)
			const headers = new Headers(res.headers)

			for (const [k, v] of Object.entries(jsonHeaders)) {
				headers.set(k, v)
			}

			return new Response(res.body, {
				status: res.status,
				headers,
			})
		}

		const cached = await cache.get(url.href)
		if (cached != null) {
			return new Response(cached, {
				headers: jsHeaders,
			})
		}

		const result = await transpile(url, {})

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
							new URL(`./${groups.href}`, new URL(pathPrefix, reqUrl).href).href
						}${groups.quot}`

						return replacement
					})
			}`

			return cache.set(href, code)
		}))

		return new Response((await cache.get(url.href))!, { headers: jsHeaders })
	} catch (e) {
		console.error(e)
		return new Response(JSON.stringify({ error: String(e) }), {
			status: STATUS_CODE.InternalServerError,
			headers: jsonHeaders,
		})
	}
})
