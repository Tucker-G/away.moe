import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteExpiredEntries, getExpiredBucketKeys } from "./db";
import type { Env } from "./types";
import upload from "./api/upload";
import download from "./api/download";
import mail from "./api/mail";

export type { Env };

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
	const host = c.req.header("host")?.split(":")[0];
	const parts = host?.split(".");
	if (!parts || parts.length <= 2) {
		await next();
		return;
	}
	const subdomain = parts[0].toLowerCase();
	if ([...subdomain].every((c) => c === 'w')) {
		await next();
		return;
	}
	return c.json({error: "not found"}, 404);
});

app.use(
	"/api/*",
	cors({
		origin: (origin) => origin,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
		exposeHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
		maxAge: 600,
	})
);

app.route("/api", upload);
app.route("/api", download);
app.route("/api", mail);

// Everything else: serve the SPA / static assets. Reached only after the
// subdomain check above has allowed the request through.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
	fetch: app.fetch,

	async scheduled(_event: ScheduledController, env: Env): Promise<void> {
		const bucketKeys = await getExpiredBucketKeys(env.DB);
		await Promise.all(bucketKeys.map(key => env.FILES.delete(key)));
		await deleteExpiredEntries(env.DB);
	},
} satisfies ExportedHandler<Env>;
