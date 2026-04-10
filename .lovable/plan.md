

## Plan: Simplified Auth + User Profiles with QR Codes + Database Integration

### What Changes

**1. Simplify Login (No OTP Verification)**
- Rewrite `Auth.tsx` to accept a 10-digit mobile number and log in directly using Supabase's `signInWithPassword` or create a simple phone-based session via an edge function that skips OTP verification
- Remove the OTP step entirely -- user enters phone number and taps "Login" to proceed immediately
- The edge function will create the user in `auth.users` if they don't exist, and return a session

**2. Create `profiles` Table (Migration)**
- New table: `profiles` with columns:
  - `id` (UUID, FK to `auth.users`)
  - `phone` (text, unique)
  - `display_name` (text)
  - `avatar_url` (text, nullable)
  - `qr_code_id` (text, unique, auto-generated) -- unique identifier embedded in QR codes
  - `balance` (numeric, default 0)
  - `created_at` (timestamp)
- RLS policies: users can read any profile (for payments), update only their own
- Trigger to auto-create profile on signup with a unique `qr_code_id`

**3. Create `transactions` Table (Migration)**
- Columns: `id`, `sender_id`, `receiver_id`, `amount`, `status`, `description`, `created_at`
- RLS: users can see transactions where they are sender or receiver
- Users can insert transactions where they are the sender

**4. Update Edge Function: `login-phone`**
- Replace `send-otp` and `verify-otp` with a single `login-phone` function
- Accepts phone number, creates user if not exists via Supabase Admin API, returns session directly

**5. Update Profile Page**
- Fetch real user data from `profiles` table
- Display the user's unique QR code (generated client-side using `qrcode.react` library)
- QR code encodes a URL like `vaanipay://pay/{qr_code_id}` or a JSON payload with the user's ID
- Show real balance, phone number, display name
- Allow editing display name

**6. Update ScanQR Page**
- When a QR code is scanned, parse the `qr_code_id`
- Look up the receiver's profile from the database
- Navigate to a payment screen pre-filled with the receiver's info

**7. Create Payment Flow**
- New `PayViaQR.tsx` page: shows receiver info, amount input, confirm button
- On confirm, insert a row into `transactions` table
- Deduct from sender balance, add to receiver balance (via an edge function for atomicity)

**8. Connect Existing Pages to Database**
- `Index.tsx`: Show real user name, real balance, real recent transactions
- `History.tsx`: Fetch from `transactions` table
- `Balance.tsx`: Fetch from `profiles.balance`
- Profile logout button: call `signOut()`

### Technical Details

- **QR Code Library**: Install `qrcode.react` for generating QR codes on the profile page
- **Database tables**: 2 new tables (`profiles`, `transactions`) via migrations
- **Edge functions**: 1 new (`login-phone`), optionally a `process-payment` function for atomic balance transfers
- **Auth flow**: Phone number entry -> edge function creates/finds user -> returns session -> redirect to home
- **Files modified**: `Auth.tsx`, `Profile.tsx`, `ScanQR.tsx`, `Index.tsx`, `History.tsx`, `Balance.tsx`, `App.tsx`, `AuthContext.tsx`
- **Files created**: `PayViaQR.tsx`, migration files, `login-phone/index.ts`, possibly `process-payment/index.ts`

