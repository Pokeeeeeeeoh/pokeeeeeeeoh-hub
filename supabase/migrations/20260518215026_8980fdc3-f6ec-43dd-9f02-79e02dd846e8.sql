
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS gdpr_short text NOT NULL DEFAULT 'We store the details you submit (name, email, phone, and your booking notes/images) only to process your booking. Your appointment is also synced to our private Google Calendar. See our Privacy Notice for details.',
ADD COLUMN IF NOT EXISTS gdpr_full text NOT NULL DEFAULT '# Privacy Notice

We take your privacy seriously. This page explains what we collect and why, in line with GDPR.

## What we collect
- Your name, email, and phone number
- The details and reference images you submit for your tattoo idea
- The date and time of your appointment

## Why we collect it
- To review and confirm your booking
- To contact you about your appointment
- To prepare for your session

## Where it''s stored
- In our secure booking database (access restricted to the studio).
- Your appointment (with your name, email, phone, and tattoo notes) is also synced to our private Google Calendar so we can manage our schedule.

## How long we keep it
We keep your booking information for as long as you are a client, and for a reasonable period afterwards to handle follow-ups, repeat bookings, or tax/accounting obligations.

## Your rights
You can request:
- A copy of the data we hold about you
- Correction of incorrect information
- Deletion of your data ("right to be forgotten")

To exercise any of these rights, email us using the address on our homepage.

## Cookies and tracking
This site uses only the minimum cookies necessary to make booking work. We do not run advertising trackers.';
