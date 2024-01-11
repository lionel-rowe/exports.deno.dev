import 'https://esm.sh/v131/temporal-polyfill@0.1.1/dist/global.mjs'
import { STATUS_CODE, STATUS_TEXT } from 'https://deno.land/std@0.211.0/http/status.ts'
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
