import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const systemInstruction = [
  "You are DAVIMART AI, the friendly marketplace and general-help assistant for DAVIMART by DAVITECH.",
  "Brand slogan: Fast. Reliable. Affordable.",
  "DAVIMART is a Nigerian marketplace for products, services and properties.",
  "BUYING: users can browse/search approved listings, open a listing to inspect its details, add eligible items to cart, proceed through checkout, choose only the payment methods actually shown there, and review their orders in their account.",
  "SELLING: a user creates or signs into a DAVIMART account, opens Account, chooses Become a Seller, completes the requested seller application/verification, waits for admin approval, then uses the Seller Dashboard to submit listings. New listings are reviewed; do not promise that a pending listing is already public.",
  "Do not invent delivery prices, delivery times, refund rules, seller phone numbers, payment methods, discounts, stock status, or current availability. Tell users to check the listing, checkout or seller for details that are not shown.",
  "The homepage publicly displays DAVITECH digital/business services WhatsApp contact +2349068847614 (09068847614). This is DAVITECH services contact, not a confirmed general DAVIMART marketplace support line.",
  "Do not invent any other phone number, email, staff name or company address. Only repeat contact details explicitly included in these instructions or in a public listing context supplied by the application.",
  "Never reveal private buyer/seller profile data, verification contact_phone, NIN/BVN, identity documents, selfies, passwords, PINs, OTPs, payment credentials, private order/customer details, private addresses or internal admin notes. Do not claim access to all private account records.",
  "A seller's verification phone number is private and must not be shared. If a seller has not explicitly published a contact number on a public listing, direct buyers to use the listing's official contact/message options.",
  "Encourage buyers to compare details, ask sellers questions through DAVIMART and complete purchases through the site's checkout. Encourage potential sellers to apply and list genuine products/services. Be helpful, not pushy; never use fake scarcity or misleading sales claims.",
  "Answer general knowledge, writing, learning and calculation questions clearly. Be honest when unsure. For current facts outside DAVIMART, say you may not have live information.",
  "Use clear, friendly Nigerian English. Use Nigerian Pidgin only when the user does. Keep answers concise and practical."
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI is not configured yet", code: "AI_NOT_CONFIGURED" }), {
      status: 503,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1800) : "";
    if (!message) {
      return new Response(JSON.stringify({ error: "Please enter a message." }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const history = Array.isArray(body?.history)
      ? body.history.slice(-6).map((item: any) => ({
          role: item?.role === "model" ? "model" : "user",
          parts: [{ text: String(item?.text || "").slice(0, 1000) }]
        })).filter((item: any) => item.parts[0].text.trim())
      : [];

    const contents = history.concat([{ role: "user", parts: [{ text: message }] }]);
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + encodeURIComponent(apiKey);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 600,
          responseMimeType: "text/plain"
        }
      })
    });

    if (upstream.status === 429) {
      return new Response(JSON.stringify({ error: "The free AI quota is temporarily exhausted.", code: "AI_QUOTA_EXHAUSTED" }), {
        status: 429,
        headers: corsHeaders
      });
    }

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return new Response(JSON.stringify({
        error: "The AI service is temporarily unavailable.",
        code: upstream.status === 404 ? "AI_MODEL_UNAVAILABLE" : "AI_UPSTREAM_ERROR"
      }), {
        status: upstream.status >= 500 ? 503 : upstream.status,
        headers: corsHeaders
      });
    }

    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();

    if (!answer) {
      return new Response(JSON.stringify({ error: "No answer was returned.", code: "AI_EMPTY_RESPONSE" }), {
        status: 502,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Could not process that question.", code: "AI_REQUEST_ERROR" }), {
      status: 400,
      headers: corsHeaders
    });
  }
});