import { Resend } from "resend";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { firstName, lastName, email, requestType, message } = req.body || {};

    if (!firstName || !lastName || !email || !requestType || !message) {
      return res.status(400).json({
        message: "Ju lutem plotësoni të gjitha fushat.",
      });
    }

    if (
      !process.env.RESEND_API_KEY ||
      !process.env.CONTACT_FROM_EMAIL ||
      !process.env.CONTACT_TO_EMAIL
    ) {
      return res.status(500).json({
        message: "Mungojnë environment variables për email.",
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Kontakt i ri nga website - ${requestType}`,
      html: `
        <h2>Kërkesë e re nga forma e kontaktit</h2>
        <p><strong>Emri:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Natyra e kërkesës:</strong> ${requestType}</p>
        <p><strong>Mesazhi:</strong></p>
        <p>${String(message).replace(/\n/g, "<br/>")}</p>
      `,
    });

    if (result?.error) {
      return res.status(500).json({
        message: result.error.message || "Dërgimi i email-it dështoi.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Contact function crash:", error);
    return res.status(500).json({
      message: error?.message || "A server error has occurred",
    });
  }
}