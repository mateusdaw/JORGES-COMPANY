const SITE_CONTENT = `
FULL WEBSITE CONTENT FOR JORGE'S HVAC (use this as source of truth):

Brand: Jorge's Air Conditioning & Heating (Jorge's HVAC)
Hero: "COMFORT THAT HOLDS UP. SERVICE THAT SHOWS UP."
Lead: Heating, cooling, and hot water for Massachusetts homes — installed clean, priced clear, and built to last through every season.

Mass Save® Heat Pump Installer:
- Big HVAC incentives available — especially for heat pumps.
- Jorge's helps check eligibility and pursue savings.
- If a system does not receive incentives, it is usually due to specific Mass Save program rules.
- Do not invent exact rebate dollar amounts unless the customer already stated them.
- Customer testimonial mentions help applying for $10K in rebates on a past job — treat as example, not a guaranteed amount for every home.

Company facts:
- Founder: Fabiano Jorge José Júnior (the person shown with the branded van / polo)
- Based in Marlborough, Massachusetts since 2019
- 10+ years HVAC experience
- Phone: (508) 736-5180
- Email: hvacjorges@gmail.com
- Address: 200 E Main St, Marlborough, MA 01752
- Instagram: @jorges_company
- Licensed crew — residential & commercial

Welcome / About:
- Welcome to Jorge's Air Conditioning & Heating.
- Founded by Fabiano Jorge José Júnior, over a decade of HVAC experience in Massachusetts — installs, repairs, and service done with care.
- Based in Marlborough since 2019; first-class workmanship and comfort.
- Promise: Clear answers. Fair pricing. Quality that matches the Jorge's name on the van.

Service pillars on site:
- Repair & installation: Fast diagnostics, clean installs, systems sized for the home.
- Heat pumps & gas: High-efficiency options with proper load calc, airflow, start-up checks.
- On time. On point.: Clear schedules, tidy job sites, work they put their name on.

Services listed on site:
01 Cooling — Air Conditioning: Tune-ups, repairs, and new AC installs.
02 Heating — Heating Systems: Furnaces and heat pumps with precise airflow, controls, safety checks.
03 Air Quality — Indoor Air Quality: Ductwork, filtration, airflow solutions.
04 Hot Water — Water Heaters: Efficient gas water heaters, code-compliant installs.

Service standard band:
- "Precision installs. Honest answers. Clean job sites."
- From first diagnosis to final start-up, protect the home and the customer's time.

Why call Jorge's:
- Quality equipment. Careful installs.
- Mass Save® partner — help capturing available rebates
- Heat pump and high-efficiency specialists
- Residential and light commercial projects
- Clear quotes and accountable follow-through

Testimonial:
- Isac Silva, Homeowner & Contractor — recommends Jorge's; oil to high-efficiency conversion; Mass Save rebate help.

Equipment partners shown: American Standard, Viessmann, Goodman, Fujitsu, Trane, Concord, Daikin, Mass Save.

Contact CTA: Ready for a more comfortable home? Call or email for inspection, options, and a clear plan.

Videos on site: fleet & crew / on the job.
`.trim();

const SYSTEM_PROMPT = `You are the live AI assistant on the Jorge's HVAC website chat widget.

${SITE_CONTENT}

Rules:
- Answer using the website content above as your knowledge base. Prefer facts from the site.
- Be professional, clear, and helpful — like a top American HVAC service desk.
- Keep replies concise (usually 2–5 sentences) unless the customer asks for more detail.
- Reply in the customer's language (English, Portuguese, Spanish, or whatever language they write in). Always match their language.
- Do NOT invent prices, appointment slots, license numbers, or rebate amounts.
- For quotes, emergencies, or scheduling, direct them to call (508) 736-5180 or email hvacjorges@gmail.com.
- If something is not on the site, say you can connect them with the team by phone/email.
- Only discuss Jorge's HVAC, comfort systems, Mass Save HVAC incentives, and contacting the company.`;

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
          "Our AI assistant is almost ready. Meanwhile call Jorge's at (508) 736-5180 or email hvacjorges@gmail.com for AC, heating, heat pumps, water heaters, and Mass Save questions.",
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
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2500) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Need a user message" }) };
  }

  // Prefer fast chat models; fall back if an account cannot use a given ID.
  const modelAttempts = [
    { model: "claude-haiku-4-5", max_tokens: 700 },
    { model: "claude-sonnet-5", max_tokens: 1200, thinking: { type: "disabled" } },
    { model: "claude-sonnet-4-6", max_tokens: 700 },
    { model: "claude-sonnet-4-5", max_tokens: 700 },
  ];

  try {
    let data = null;
    let lastError = null;

    for (const attempt of modelAttempts) {
      const body = {
        model: attempt.model,
        max_tokens: attempt.max_tokens,
        system: SYSTEM_PROMPT,
        messages,
      };
      if (attempt.thinking) body.thinking = attempt.thinking;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        data = json;
        break;
      }

      lastError = {
        status: resp.status,
        type: json?.error?.type || null,
        message: json?.error?.message || null,
        model: attempt.model,
      };
      console.error("Anthropic error", lastError);

      // Retry on model/not-found style errors; stop on auth/billing.
      const msg = String(json?.error?.message || "").toLowerCase();
      const type = String(json?.error?.type || "").toLowerCase();
      if (
        type.includes("authentication") ||
        type.includes("permission") ||
        type.includes("rate_limit") ||
        msg.includes("credit") ||
        msg.includes("billing") ||
        msg.includes("api key")
      ) {
        break;
      }
    }

    if (!data) {
      const authIssue =
        lastError &&
        /auth|permission|api key|credit|billing/i.test(
          `${lastError.type || ""} ${lastError.message || ""}`
        );
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: authIssue ? "api_auth_or_billing" : "upstream_error",
          detail: lastError
            ? `${lastError.model}: ${lastError.type || "error"}`
            : "unknown",
          reply: authIssue
            ? "The AI key needs billing/access enabled in the Anthropic console. Meanwhile call (508) 736-5180 and our team will help you."
            : "I hit a temporary connection issue. Please call (508) 736-5180 and our team will help you right away.",
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
