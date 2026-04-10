
-- Create OTP codes table for phone authentication
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (needed for unauthenticated OTP flow)
CREATE POLICY "Anyone can create OTP" ON public.otp_codes FOR INSERT WITH CHECK (true);

-- Allow anyone to read OTP (edge function verifies)
CREATE POLICY "Anyone can read OTP" ON public.otp_codes FOR SELECT USING (true);

-- Allow anyone to update OTP (for marking verified)
CREATE POLICY "Anyone can update OTP" ON public.otp_codes FOR UPDATE USING (true);

-- Allow anyone to delete OTP
CREATE POLICY "Anyone can delete OTP" ON public.otp_codes FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_otp_codes_phone ON public.otp_codes(phone, created_at DESC);
