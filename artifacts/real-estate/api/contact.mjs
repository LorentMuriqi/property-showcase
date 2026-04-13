export default async function handler(req, res) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    const toEmail = process.env.CONTACT_TO_EMAIL;

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        env: {
          hasApiKey: Boolean(apiKey),
          fromEmail,
          toEmail,
        },
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { firstName, lastName, email, requestType, message } = req.body || {};

    if (!firstName || !lastName || !email || !requestType || !message) {
      return res.status(400).json({
        message: "Ju lutem plotësoni të gjitha fushat.",
      });
    }

    if (!apiKey || !fromEmail || !toEmail) {
      return res.status(500).json({
        message: "Mungojnë environment variables për email.",
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `Kontakt i ri nga website - ${requestType}`,
        html: `
          <h2>Kërkesë e re nga forma e kontaktit</h2>
          <p><strong>Emri:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Natyra e kërkesës:</strong> ${requestType}</p>
          <p><strong>Mesazhi:</strong></p>
          <p>${String(message).replace(/\n/g, "<br/>")}</p>
        `,
      }),
    });

    const raw = await resendResponse.text();
	console.log("RESEND RAW RESPONSE:", raw);

    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    return res.status(resendResponse.ok ? 200 : 500).json({
      ok: resendResponse.ok,
      status: resendResponse.status,
      resend: data || raw,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "A server error has occurred",
      stack: error?.stack || null,
    });
  }
}