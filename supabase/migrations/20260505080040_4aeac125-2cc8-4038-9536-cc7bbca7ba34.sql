
-- Email templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view email templates" ON public.email_templates FOR SELECT USING (true);
CREATE POLICY "Admins can update email templates" ON public.email_templates FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert email templates" ON public.email_templates FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email log
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  template_key text,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  booking_request_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view email log" ON public.email_log FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can insert email log" ON public.email_log FOR INSERT WITH CHECK (true);
CREATE INDEX idx_email_log_created_at ON public.email_log (created_at DESC);

-- UI text
CREATE TABLE public.ui_text (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ui_text ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ui text" ON public.ui_text FOR SELECT USING (true);
CREATE POLICY "Admins can update ui text" ON public.ui_text FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert ui text" ON public.ui_text FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER trg_ui_text_updated BEFORE UPDATE ON public.ui_text FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default email templates
INSERT INTO public.email_templates (key, name, subject, body_html) VALUES
('booking_confirmation_client', 'Booking received (client)', 'We received your booking request',
'<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#000;background:#fff;"><h1 style="font-size:22px;margin:0 0 16px;">Booking request received</h1><p style="font-size:14px;line-height:1.6;color:#333;">Hi {{name}}, thanks for your booking request. I''ve received it and will review it shortly. You''ll get another email with a link to pick a time slot once it''s approved.</p><p style="font-size:12px;color:#777;margin-top:32px;">— pokeeeeeeeoh</p></div>'),
('booking_confirmation_admin', 'New request (admin notification)', 'New booking request from {{name}}',
'<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#000;background:#fff;"><h1 style="font-size:22px;margin:0 0 16px;">New booking request</h1><p style="font-size:14px;line-height:1.6;color:#333;">{{name}} ({{email}}) just submitted a booking request. Open the admin dashboard to review and approve it.</p></div>'),
('approval', 'Request approved', 'Your booking request was approved',
'<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#000;background:#fff;"><h1 style="font-size:22px;margin:0 0 16px;">Your booking request was approved</h1><p style="font-size:14px;line-height:1.6;color:#333;">Hi {{name}}, thanks for your request. It''s been approved and you can now pick a time slot using the link below.</p><p style="margin:28px 0;"><a href="{{bookingUrl}}" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;border-radius:4px;">Choose your appointment</a></p><p style="font-size:12px;color:#777;word-break:break-all;">{{bookingUrl}}</p></div>'),
('decline', 'Request declined', 'About your booking request',
'<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#000;background:#fff;"><h1 style="font-size:22px;margin:0 0 16px;">About your booking request</h1><p style="font-size:14px;line-height:1.6;color:#333;">Hi {{name}}, thanks for reaching out. Unfortunately I''m not able to take this on right now.</p><p style="font-size:14px;line-height:1.6;color:#333;">{{reason}}</p><p style="font-size:12px;color:#777;margin-top:32px;">— pokeeeeeeeoh</p></div>'),
('appointment_booked', 'Appointment confirmed', 'Your appointment is confirmed',
'<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#000;background:#fff;"><h1 style="font-size:22px;margin:0 0 16px;">Appointment confirmed</h1><p style="font-size:14px;line-height:1.6;color:#333;">Hi {{name}}, your appointment is confirmed for <strong>{{appointmentTime}}</strong>. See you then!</p><p style="font-size:12px;color:#777;margin-top:32px;">— pokeeeeeeeoh</p></div>');

-- Seed default UI text
INSERT INTO public.ui_text (key, label, value, category) VALUES
('booking_info_step', 'Booking info — step label', 'Step 1 of 2', 'booking_info'),
('booking_info_title', 'Booking info — title', 'Before You Book', 'booking_info'),
('booking_info_subtitle', 'Booking info — subtitle', 'Please read through the following information carefully before submitting your request.', 'booking_info'),
('booking_info_acknowledge', 'Booking info — acknowledgement', 'I have read and understood the booking information, policies, and preparation guidelines.', 'booking_info'),
('booking_info_continue', 'Booking info — continue button', 'Continue to Form', 'booking_info'),

('form_step', 'Form — step label', 'Step 2 of 2', 'form'),
('form_title', 'Form — title', 'Tell Us About Your Idea', 'form'),
('form_subtitle', 'Form — subtitle', 'Fill out the form below with details about your tattoo concept.', 'form'),
('form_contact_heading', 'Form — contact section heading', 'Contact Information', 'form'),
('form_details_heading', 'Form — details section heading', 'Tattoo Details', 'form'),
('form_images_heading', 'Form — images section heading', 'Reference Images *', 'form'),
('form_images_subtitle', 'Form — images section subtitle', 'Upload reference images, inspiration, or sketches of your idea.', 'form'),
('form_submit', 'Form — submit button', 'Submit Booking Request', 'form'),
('form_submit_disclaimer', 'Form — disclaimer under submit', 'By submitting, you agree to our booking policies. Your request will be reviewed within 24-48 hours.', 'form'),

('confirmation_title', 'Confirmation — title', 'Request Submitted!', 'confirmation'),
('confirmation_subtitle', 'Confirmation — subtitle', 'Thank you for your booking request. We''ve received your information and will review it shortly.', 'confirmation'),
('confirmation_email_heading', 'Confirmation — email card heading', 'Check Your Email', 'confirmation'),
('confirmation_email_body', 'Confirmation — email card body', 'You''ll receive a confirmation email with your request details.', 'confirmation'),
('confirmation_next_heading', 'Confirmation — next card heading', 'What Happens Next', 'confirmation'),
('confirmation_next_body', 'Confirmation — next card body', 'We''ll review your request within 24-48 hours. If approved, you''ll receive an email with a link to select your appointment time.', 'confirmation'),
('confirmation_disclaimer', 'Confirmation — bottom disclaimer', 'Important: No appointment has been booked yet. You must complete the booking process after approval.', 'confirmation'),

('slot_title', 'Slot select — title', 'Select Your Appointment', 'slot'),
('slot_subtitle', 'Slot select — subtitle', 'Choose from the available slots below', 'slot'),
('slot_booked_title', 'Slot booked — title', 'Appointment Booked!', 'slot'),
('slot_booked_subtitle', 'Slot booked — subtitle', 'Your appointment is confirmed. We''ll send a confirmation email with all the details.', 'slot');
