// Minimal, provider-agnostic email sender. Uses Resend's HTTP API directly
// (no SDK dependency) when RESEND_API_KEY is configured; otherwise logs to
// the server console and returns without throwing, so the app keeps working
// end-to-end (in-app notifications still fire) even before an email
// provider is wired up. To go live: create a Resend account, verify a
// sending domain, and set RESEND_API_KEY + SUPPORT_FROM_EMAIL in the env.
export async function sendEmail(params: { to: string | string[]; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM_EMAIL ?? "Party-up <support@party-up.example>";
  const to = Array.isArray(params.to) ? params.to : [params.to];

  if (!apiKey) {
    console.log(`[email:noop] RESEND_API_KEY not set — would have sent "${params.subject}" to ${to.join(", ")}`);
    return { sent: false as const, reason: "no_api_key" as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject: params.subject, html: params.html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[email:error] Resend API returned ${res.status}: ${body}`);
    return { sent: false as const, reason: "provider_error" as const };
  }

  return { sent: true as const };
}
