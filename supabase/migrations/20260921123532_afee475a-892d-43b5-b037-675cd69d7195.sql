INSERT INTO public.email_templates (key, name, subject, body_html)
SELECT 'reschedule', 'Rebooking link', 'Pick a new time for your tattoo appointment',
$html$<div style="font-family:Helvetica,Arial,sans-serif;color:#111111;background:#ffffff;padding:24px;line-height:1.6;">
  <h2 style="margin:0 0 16px;font-size:20px;">Let's find you a new time</h2>
  <p>Hi {{name}},</p>
  <p>Your previous appointment has been released. You can choose a new time that suits you using the link below — all your booking details are already saved, so there's nothing to fill in again.</p>
  <p style="margin:24px 0;">
    <a href="{{bookingUrl}}" style="background:#111111;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Choose a new time</a>
  </p>
  <p style="font-size:13px;color:#555555;">This link is valid for 14 days. If it expires, just reply to this email and we'll send you a new one.</p>
  <p style="font-size:13px;color:#555555;">{{siteName}} · {{address}}</p>
</div>$html$
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE key = 'reschedule');