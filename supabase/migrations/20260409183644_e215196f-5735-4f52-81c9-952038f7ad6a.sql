
-- Add upi_id column to profiles
ALTER TABLE public.profiles 
ADD COLUMN upi_id text UNIQUE;

-- Create index for fast UPI ID lookups
CREATE INDEX idx_profiles_upi_id ON public.profiles (upi_id);

-- Create index for phone lookups
CREATE INDEX idx_profiles_phone ON public.profiles (phone);
