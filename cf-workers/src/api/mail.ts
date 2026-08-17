import { Hono, TypedResponse } from "hono";

import {GenericResponse, MailRequestSchema} from "@away-moe/shared";

const mail = new Hono<{ Bindings: Env }>();

mail.post("/send_mail/", async (c): Promise<TypedResponse<GenericResponse>> => {
	const body = MailRequestSchema.safeParse(await c.req.json());
	if (!body.success) {
		return c.json({ success: false, error: "Invalid JSON body" }, 400);
	}
	const { message, sender } = body.data
	c.executionCtx.waitUntil(c.env.EMAIL.send({
        to: c.env.RECEIVING_EMAIL_ADDRESS,
        from: "noreply@away.moe",
        subject: "you've got mail",
        text: `sender: ${sender}\n\n${message}\n\nIP: ${c.req.header("CF-Connecting-IP")}`,
      }));
	console.log({event: "mail sent", message});
	return c.json({success: true})

});

export default mail;
