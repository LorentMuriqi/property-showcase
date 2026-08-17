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

const normalizePhone = (phone) => {
  const digits = sanitizePhone(phone);
  return digits.startsWith("0") ? digits.slice(1) : digits;
};

const isPhoneValid = (code, phone) => {
  const normalized = normalizePhone(phone);
  return normalized.length === PHONE_LENGTHS[code];
};


async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_CONTACT_SECRET_KEY;

  if (!secret || !token) {
    return {
      success: false,
      "error-codes": ["missing-input"],
    };
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    }
  );

  if (!response.ok) {
    return {
      success: false,
      "error-codes": ["siteverify-request-failed"],
    };
  }

  return response.json();
}


export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const {
      firstName,
      lastName,
      email,
      countryCode,
      phoneNumber,
      requestType,
      message,
      turnstileToken,
    } = req.body || {};

    // 1. Kontrollo nëse Turnstile token ekziston
    if (!turnstileToken) {
      return res.status(400).json({
        message: "Verifikimi i sigurisë mungon.",
      });
    }

    // 2. Verifiko token-in me Cloudflare
    const turnstileResult = await verifyTurnstile(turnstileToken);

    const allowedHostnames = new Set([
      "auraks.com",
      "www.auraks.com",
      "property-showcase-real-estate.vercel.app",
    ]);

    if (
      !turnstileResult.success ||
      !allowedHostnames.has(turnstileResult.hostname)
    ) {
      console.warn("Turnstile verification failed:", {
        hostname: turnstileResult.hostname,
        errorCodes: turnstileResult["error-codes"],
      });

      return res.status(400).json({
        message:
          "Verifikimi i sigurisë dështoi. Ju lutemi provoni përsëri.",
      });
    }

    // 3. Kontrollo telefonin
    if (!isPhoneValid(countryCode, phoneNumber)) {
      return res.status(400).json({
        message: "Numri i telefonit është i pavlefshëm.",
      });
    }

    if (!firstName || !lastName || !countryCode || !phoneNumber || !requestType || !message) {
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
        ...(email ? { reply_to: email } : {}),
        subject: `Kontakt i ri - ${requestType}`,
        html: `
          <h2>Kërkesë e re nga website</h2>
          <p><strong>Emri:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
		  <p><strong>Telefoni:</strong> ${countryCode}${normalizePhone(phoneNumber)}</p>
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