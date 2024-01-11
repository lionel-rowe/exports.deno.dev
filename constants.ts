const CHARSET = 'charset=utf-8'
const ContentType = {
	Js: `application/javascript; ${CHARSET}`,
	Json: `application/json; ${CHARSET}`,
	Html: `text/html; ${CHARSET}`,
} as const

const _headers = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET',
} as const
export const JS_HEADERS = {
	..._headers,
	'Content-Type': ContentType.Js,
} as const
export const JSON_HEADERS = {
	..._headers,
	'Content-Type': ContentType.Json,
} as const
export const HTML_HEADERS = {
	..._headers,
	'Content-Type': ContentType.Html,
} as const

export const ALLOWED_PROTOCOLS = (['http', 'https'] as const).map((x) => `${x}:` as const)

export const PATH_PREFIX = '/s/'

export const ONE_YEAR_IN_MILLISECONDS = Temporal.Duration.from({ years: 1 }).total({
	unit: 'milliseconds',
	relativeTo: new Temporal.Instant(0n).toZonedDateTimeISO('UTC'),
})
