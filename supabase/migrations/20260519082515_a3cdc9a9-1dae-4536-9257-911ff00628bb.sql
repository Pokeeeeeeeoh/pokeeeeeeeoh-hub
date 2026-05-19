UPDATE public.email_templates
SET body_html = replace(
  body_html,
  'Questions? Reply to this email or write to <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a>.',
  'Questions? Please email <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a> — replies to this address are not monitored.'
);

UPDATE public.email_templates
SET body_html = replace(
  body_html,
  'If you need to reschedule or cancel, please reply to this email or write to <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a> as soon as possible.',
  'If you need to reschedule or cancel, please email <a href="mailto:pokeeeeeeeoh@gmail.com" style="color:#000;">pokeeeeeeeoh@gmail.com</a> as soon as possible — replies to this address are not monitored.'
)
WHERE key = 'appointment_reminder';