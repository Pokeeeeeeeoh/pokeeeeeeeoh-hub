UPDATE public.email_templates
SET body_html = replace(
  body_html,
  '<p style="font-size:12px;color:#777;margin-top:32px;">— pokeeeeeeeoh</p></div>',
  '<p style="font-size:13px;color:#333;margin-top:32px;">Questions? Reply to this email or write to <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a>.</p><p style="font-size:12px;color:#777;margin-top:16px;">— pokeeeeeeeoh</p></div>'
)
WHERE key IN ('booking_confirmation_client','decline','appointment_booked');

UPDATE public.email_templates
SET body_html = replace(
  body_html,
  '<p style="font-size:12px;color:#777;word-break:break-all;">{{bookingUrl}}</p></div>',
  '<p style="font-size:12px;color:#777;word-break:break-all;">{{bookingUrl}}</p><p style="font-size:13px;color:#333;margin-top:32px;">Questions? Reply to this email or write to <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a>.</p><p style="font-size:12px;color:#777;margin-top:16px;">— pokeeeeeeeoh</p></div>'
)
WHERE key = 'approval';

UPDATE public.email_templates
SET body_html = replace(
  body_html,
  '<p>If you need to reschedule or cancel, please reply to this email as soon as possible.</p>',
  '<p>If you need to reschedule or cancel, please reply to this email or write to <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a> as soon as possible.</p>'
)
WHERE key = 'appointment_reminder';