
-- Drop overly permissive policies on otp_codes
DROP POLICY IF EXISTS "Anyone can create OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can delete OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can read OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP" ON public.otp_codes;
