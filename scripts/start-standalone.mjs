// Entry point for the standalone build (Docker / VPS). Place it next to `server.js` and run `node start-standalone.mjs`.
//
// Next.js 15.5 quirk, reproduced during development: with HOSTNAME=127.0.0.1 the standalone server turns
// middleware rewrites into redirects to another origin, which breaks every localized route (next-intl uses
// rewrites for localized pathnames). HOSTNAME=localhost and HOSTNAME=0.0.0.0 work, so normalize the value
// before the server reads it. Binding to loopback behind a reverse proxy is common, hence this guard.
if (process.env.HOSTNAME === '127.0.0.1') process.env.HOSTNAME = 'localhost';

await import('./server.js');
