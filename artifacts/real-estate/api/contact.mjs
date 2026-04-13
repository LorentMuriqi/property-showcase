const PHONE_LENGTHS = {
  "+383": 8,
  "+355": 9,
  "+389": 8,
  "+382": 8,
  "+387": 8,
  "+385": 9,
  "+386": 8,
};

const sanitizePhone = (value) => String(value || "").replace(/\D/g, "");

const isPhoneValid = (code, phone) => {
  const digits = sanitizePhone(phone);
  return digits.length === PHONE_LENGTHS[code];
};


export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { firstName, lastName, email, countryCode, phoneNumber, requestType, message } = req.body || {};

if (!isPhoneValid(countryCode, phoneNumber)) {
  return res.status(400).json({
    message: "Numri i telefonit është i pavlefshëm.",
  });
}

    if (!firstName || !lastName || !email || !countryCode || !phoneNumber || !requestType || !message) {
      return res.status(400).json({
        message: "Ju lutem plotësoni të gjitha fushat.",
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    const toEmail = process.env.CONTACT_TO_EMAIL;

    if (!apiKey || !fromEmail || !toEmail) {
      return res.status(500).json({
        message: "Konfigurimi i email-it mungon.",
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
        subject: `Kontakt i ri - ${requestType}`,
        html: `
          <h2>Kërkesë e re nga website</h2>
          <p><strong>Emri:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
		  <p><strong>Telefoni:</strong> ${countryCode}${sanitizePhone(phoneNumber)}</p>
          <p><strong>Tipi:</strong> ${requestType}</p>
          <p><strong>Mesazhi:</strong></p>
          <p>${String(message).replace(/\n/g, "<br/>")}</p>
        `,
      }),
    });

    if (!resendResponse.ok) {
      console.error("Resend error:", await resendResponse.text());

      return res.status(500).json({
        message: "Dërgimi i mesazhit dështoi.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mesazhi u dërgua me sukses.",
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      message: "Gabim në server.",
    });
  }
}