// workaround for https://github.com/denoland/deno_cache_dir/issues/35
// and https://github.com/denoland/deploy_feedback/issues/527
// (deno_cache_dir is a dependency of @deno/emit)

// Generated as follows in Deno Deploy playground:
// Object.fromEntries(
// 	await Promise.all((['run', 'read', 'write', 'net', 'env', 'sys', 'ffi'] as const).map(async (name) => {
// 		try {
// 			return [name, (await Deno.permissions.query({ name })).state]
// 		} catch {
// 			return [name, 'denied']
// 		}
// 	})),
// )

const permissions = {
	run: 'denied',
	read: 'granted',
	write: 'denied',
	net: 'granted',
	env: 'granted',
	sys: 'denied',
	ffi: 'denied',
} as const

Deno.permissions.querySync ??= ({ name }) => {
	return {
		state: permissions[name],
		onchange: null,
		partial: false,
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent() {
			return false
		},
	}
}
