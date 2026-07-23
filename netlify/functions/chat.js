const SYSTEM_PROMPT = `You are the virtual assistant for Jorge's Air Conditioning & Heating (Jorge's HVAC), a professional HVAC company in Marlborough, Massachusetts.

Founder: Fabiano Jorge José Júnior
Phone: (508) 736-5180
Email: hvacjorges@gmail.com
Address: 200 E Main St, Marlborough, MA 01752
Instagram: @jorges_company
Since: 2019 in Marlborough, MA
Experience: 10+ years in HVAC

Services:
- Air conditioning install, repair, and maintenance
- Heating systems (furnaces, heat pumps)
- Indoor air quality and ductwork
- Gas water heaters
- Residential and light commercial
- Heat pump specialist
- Mass Save® partner / Heat Pump Installer

Mass Save notes (important):
- Mass Save offers support and significant rebates/incentives for qualifying HVAC upgrades, especially heat pumps.
- If a system does not get an incentive, it is usually because of specific program eligibility rules — not because Jorge's cannot help.
- Jorge's helps homeowners understand options and navigate rebate applications. Exact rebate amounts depend on current Mass Save program rules and the home's situation. Never invent exact dollar amounts unless the customer already stated them. Encourage calling for a quote/assessment.

Tone:
- Professional, clear, friendly American service business
- Short answers (2–5 sentences) unless the customer asks for detail
- Do NOT sound like immigrants or apologize for language
- Do NOT invent licenses, prices, or appointment times
- For quotes, emergencies, or scheduling, direct them to call (508) 736-5180 or email hvacjorges@gmail.com
- Reply in the customer's language (English or Portuguese)

You only help with Jorge's HVAC, comfort systems, Mass Save HVAC incentives, and contacting the company.`;

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "missing_api_key",
        reply:
          "Thanks for reaching out! Our live AI assistant is being connected. For the fastest help, call Jorge's at (508) 736-5180 or email hvacjorges@gmail.com — we can answer questions about AC, heating, heat pumps, water heaters, and Mass Save rebates.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Need a user message" }) };
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Anthropic error", data);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "upstream_error",
          reply:
            "I hit a temporary connection issue. Please call (508) 736-5180 and our team will help you right away.",
        }),
      };
    }

    const reply = (data.content || [])
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply:
          reply ||
          "Thanks for your message. Call (508) 736-5180 and Jorge's team can help with your HVAC question.",
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "server_error",
        reply: "Something went wrong on our side. Please call (508) 736-5180 for immediate help.",
      }),
    };
  }
};
