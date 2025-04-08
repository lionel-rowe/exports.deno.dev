import './denoPermissionsQuerySyncPolyfill.ts'
import { STATUS_CODE, STATUS_TEXT } from '@std/http/status'
import { normalize } from '@std/path/posix'
import { demoPageHtml } from './demo.ts'
import { getContent } from './getContent.ts'
import { ALLOWED_PROTOCOLS, HTML_HEADERS, JSON_HEADERS, PATH_PREFIX } from './constants.ts'

Deno.serve(async (req: Request) => {
	let scriptUrl: URL
	const reqUrl = new URL(req.url)

	if (reqUrl.pathname === '/') {
		return new Response(demoPageHtml, { headers: HTML_HEADERS })
	}

	if (!reqUrl.pathname.startsWith(PATH_PREFIX)) {
		return new Response(JSON.stringify({ error: STATUS_TEXT[STATUS_CODE.NotFound] }), {
			status: STATUS_CODE.NotFound,
			headers: JSON_HEADERS,
		})
	} else {
		const href = reqUrl.pathname.slice(PATH_PREFIX.length)
		if (href.length < 2) {
			return new Response(JSON.stringify({ error: 'Bad URL' }), {
				status: STATUS_CODE.BadRequest,
				headers: JSON_HEADERS,
			})
		}

		scriptUrl = new URL(/^\w+:/.test(href) ? href : `https://${href}`)

		if (!ALLOWED_PROTOCOLS.includes(scriptUrl.protocol as typeof ALLOWED_PROTOCOLS[number])) {
			return new Response(
				JSON.stringify({ error: `Protocol '${scriptUrl.protocol}' not allowed in URL '${scriptUrl.href}'` }),
				{
					status: STATUS_CODE.BadRequest,
					headers: JSON_HEADERS,
				},
			)
		}
	}

	if (scriptUrl.protocol === 'jsr:') {
		scriptUrl = await jsrToHttps(scriptUrl)

		const redirectTo = reqUrl.origin + PATH_PREFIX + scriptUrl.href
		return Response.redirect(
			redirectTo,
			STATUS_CODE.TemporaryRedirect,
		)
	}

	try {
		return await getContent(scriptUrl, reqUrl)
	} catch (e) {
		console.error(e)
		return new Response(JSON.stringify({ error: String(e) }), {
			status: STATUS_CODE.InternalServerError,
			headers: JSON_HEADERS,
		})
	}
})

async function jsrToHttps(url: URL | string): Promise<URL> {
	const { pathname } = new URL(url)

	const m = pathname.match(/^@(?<scope>[^/@]+)\/(?<name>[^/@]+)(?:@(?<version>[^/@]+))?(?:\/(?<subpath>.+))?$/)
	if (!m) {
		throw new Error(`Invalid jsr URL: ${url}`)
	}
	let { scope, name, version, subpath } = m.groups!

	if (!version) {
		const { latest } = await (await fetch(`https://jsr.io/@${scope}/${name}/meta.json`)).json()
		version = latest
	}

	const meta = await (await fetch(`https://jsr.io/@${scope}/${name}/${version}_meta.json`)).json()
	const exp = Object.entries(meta.exports).find(([k]) => normalize(k) === normalize(subpath ?? ''))
	if (!exp) {
		throw new Error(`Invalid jsr URL: ${url}`)
	}
	const path = exp[1]

	const resolved = new URL(`https://jsr.io/@${scope}/${name}/${version}/${path}`)
	return resolved
}
