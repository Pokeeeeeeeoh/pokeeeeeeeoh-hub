-- Create enum types
CREATE TYPE public.request_status AS ENUM ('new', 'approved', 'declined', 'booked', 'completed', 'cancelled');

-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking requests table
CREATE TABLE public.booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  status public.request_status NOT NULL DEFAULT 'new',
  form_responses JSONB NOT NULL DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  approval_token UUID DEFAULT gen_random_uuid(),
  admin_notes TEXT,
  decline_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Availability slots table
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.booking_requests(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Availability rules for recurring availability
CREATE TABLE public.availability_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  repeat_type TEXT NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'custom'
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin users table
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking form configuration
CREATE TABLE public.form_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fields JSONB NOT NULL DEFAULT '[]',
  info_content TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_config ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
  )
$$;

-- Public policies for clients (insert only for booking)
CREATE POLICY "Anyone can create a client"
ON public.clients FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Booking requests policies
CREATE POLICY "Anyone can create a booking request"
ON public.booking_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all booking requests"
ON public.booking_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Clients can view their own requests via token"
ON public.booking_requests FOR SELECT
USING (true);

CREATE POLICY "Admins can update booking requests"
ON public.booking_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Availability slots policies
CREATE POLICY "Anyone can view available slots"
ON public.availability_slots FOR SELECT
USING (true);

CREATE POLICY "Admins can manage availability"
ON public.availability_slots FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Appointments policies
CREATE POLICY "Anyone can create appointment"
ON public.appointments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Availability rules policies
CREATE POLICY "Admins can manage availability rules"
ON public.availability_rules FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin users policies
CREATE POLICY "Admins can view admin users"
ON public.admin_users FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Form config policies
CREATE POLICY "Anyone can view form config"
ON public.form_config FOR SELECT
USING (true);

CREATE POLICY "Admins can update form config"
ON public.form_config FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Insert default form configuration
INSERT INTO public.form_config (fields, info_content) VALUES (
  '[
    {"id": "placement", "type": "text", "label": "Where on your body?", "required": true},
    {"id": "size", "type": "dropdown", "label": "Approximate size", "required": true, "options": ["Small (2-4 inches)", "Medium (4-6 inches)", "Large (6+ inches)"]},
    {"id": "description", "type": "longtext", "label": "Describe your idea", "required": true},
    {"id": "style", "type": "dropdown", "label": "Style preference", "required": true, "options": ["Fine line", "Blackwork", "Traditional", "Dotwork", "Other"]},
    {"id": "first_tattoo", "type": "checkbox", "label": "Is this your first tattoo?", "required": false},
    {"id": "budget", "type": "text", "label": "Budget range", "required": false}
  ]',
  '# Booking Information

Before submitting your request, please read through the following information carefully.

## Pricing
- Minimum: $150
- Hourly rate: $180/hour
- Custom pieces are quoted individually based on complexity

## What to Expect
1. Submit your request with reference images
2. Wait for approval (typically 24-48 hours)
3. Once approved, select your appointment time
4. Receive confirmation and preparation instructions

## Policies
- 48-hour cancellation notice required
- $50 deposit required to hold your appointment
- Deposits are non-refundable but can be applied to rescheduled appointments

## Preparation
- Get a good night''s sleep
- Eat a full meal before your appointment
- Avoid alcohol 24 hours before
- Wear comfortable, appropriate clothing

## Aftercare
- Keep bandage on for 2-4 hours
- Wash gently with unscented soap
- Apply thin layer of unscented lotion
- Avoid sun exposure and swimming for 2 weeks'
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_requests_updated_at
BEFORE UPDATE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();