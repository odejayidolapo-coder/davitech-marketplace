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
  "BUYING: browse and search approved listings, open a listing to inspect its details, add eligible items to cart, proceed through checkout, choose only payment methods actually shown there, and review orders in the account.",
  "SELLING: create or sign into a DAVIMART account, open Account, choose Become a Seller, complete requested seller application and verification, wait for admin approval, then use Seller Dashboard to submit listings. Listings are reviewed; never promise a pending listing is already public.",
  "Do not invent delivery prices/times, refund rules, seller phone numbers, payment methods, discounts, stock status, or availability. Refer users to listing, checkout or seller for details not supplied.",
  "The homepage displays DAVITECH digital/business services WhatsApp contact +2349068847614 (09068847614). This is DAVITECH services contact, not a confirmed general DAVIMART marketplace support line.",
  "Never reveal private buyer/seller profile data, verification contact_phone, NIN/BVN, identity documents, selfies, passwords, PINs, OTPs, payment credentials, private order/customer details, private addresses or internal admin notes.",
  "Seller verification phone numbers are private. Only share a seller phone number when the application explicitly provides it as a public listing contact.",
  "Encourage buyers to compare details, message sellers through DAVIMART and complete purchases through site checkout. Encourage sellers to list genuine products/services. Be helpful, not pushy; never use fake scarcity or misleading claims.",
  "Answer general knowledge, writing, learning and calculation questions clearly. Be honest when unsure. You may not have live information outside DAVIMART.",
  "Use clear, friendly Nigerian English. Use Nigerian Pidgin only when the user does. Keep answers concise and practical."
].join("\n");

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

async function askGemini(apiKey: string, message: string, history: any[]) {
  const upstream = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: history.concat([{ role: "user", parts: [{ text: message }] }]),
        generationConfig: { temperature: 0.55, maxOutputTokens: 600 }
      })
    }
  );
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error("Gemini HTTP " + upstream.status);
  const answer = result?.candidates?.[0]?.content?.parts
    ?.map((part: any) => typeof part?.text === "string" ? part.text : "")
    .join("").trim();
  if (!answer) throw new Error("Gemini returned an empty response");
  return answer;
}

async function askGroq(apiKey: string, message: string, history: any[]) {
  const messages = [
    { role: "system", content: systemInstruction },
    ...history.map((item: any) => ({
      role: item.role === "model" ? "assistant" : "user",
      content: item.parts[0].text
    })),
    { role: "user", content: message }
  ];
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages,
      max_completion_tokens: 600,
      stream: false
    })
  });
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error("Groq HTTP " + upstream.status);
  const answer = result?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Groq returned an empty response");
  return answer.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1800) : "";
    if (!message) return jsonResponse({ error: "Please enter a message." }, 400);

    const history = Array.isArray(body?.history)
      ? body.history.slice(-6).map((item: any) => ({
          role: item?.role === "model" ? "model" : "user",
          parts: [{ text: String(item?.text || "").slice(0, 1000) }]
        })).filter((item: any) => item.parts[0].text.trim())
      : [];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (geminiKey) {
      try {
        const answer = await askGemini(geminiKey, message, history);
        return jsonResponse({ answer, provider: "gemini" });
      } catch (error) {
        console.warn("DAVIMART AI: Gemini unavailable; trying backup provider.", String(error));
      }
    }

    if (groqKey) {
      try {
        const answer = await askGroq(groqKey, message, history);
        return jsonResponse({ answer, provider: "groq" });
      } catch (error) {
        console.error("DAVIMART AI: backup provider failed.", String(error));
      }
    }

    if (!geminiKey && !groqKey) {
      return jsonResponse({ error: "AI is not configured yet.", code: "AI_NOT_CONFIGURED" }, 503);
    }

    return jsonResponse({
      error: "Both AI services are temporarily unavailable. Please try again shortly.",
      code: "AI_PROVIDERS_UNAVAILABLE"
    }, 503);
  } catch (_error) {
    return jsonResponse({ error: "Could not process that question.", code: "AI_REQUEST_ERROR" }, 400);
  }
});