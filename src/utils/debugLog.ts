export function dbg(...args: any[]) {
    try {
        // Support React Native __DEV__ and web NODE_ENV
        const isDev = (typeof __DEV__ !== 'undefined' && __DEV__ === true) || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');
        if (isDev) {
            // use console.debug so it is less prominent than console.log in some environments
            // but still visible during development
            // eslint-disable-next-line no-console
            console.debug(...args);
        }
    } catch (e) {
        // swallow - logging helper must not throw
    }
}
