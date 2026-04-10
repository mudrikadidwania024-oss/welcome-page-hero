/**
 * Biometric / WebAuthn authentication for transaction confirmation.
 * Uses the Web Authentication API (fingerprint, face, PIN fallback).
 * Falls back gracefully on unsupported browsers.
 */

import { speak } from "@/lib/voice";
import { toast } from "sonner";

/** Check if WebAuthn / platform authenticator is available */
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

/**
 * Request biometric authentication before a transaction.
 * Returns true if authenticated, false if cancelled/failed.
 * On unsupported devices, falls back to a confirm dialog.
 */
export const authenticateWithBiometric = async (
  amountLabel?: string
): Promise<boolean> => {
  const bioAvailable = await isBiometricAvailable();

  if (!bioAvailable) {
    // Fallback: browser confirm dialog
    await speak("Please confirm the transaction.");
    const confirmed = window.confirm(
      amountLabel
        ? `Authenticate to confirm payment of ${amountLabel}`
        : "Authenticate to confirm this payment"
    );
    if (!confirmed) {
      toast.info("Transaction cancelled");
      await speak("Transaction cancelled.");
    }
    return confirmed;
  }

  try {
    await speak("Please authenticate with your fingerprint to confirm the transaction.");

    // Create a WebAuthn challenge for user verification
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "VaaniPay",
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array(16),
          name: "vaanipay-user",
          displayName: "VaaniPay User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    });

    if (credential) {
      await speak("Authentication successful.");
      return true;
    }

    toast.info("Authentication cancelled");
    await speak("Authentication cancelled. Transaction not processed.");
    return false;
  } catch (err: any) {
    // User cancelled or error
    if (err.name === "NotAllowedError") {
      toast.info("Authentication cancelled");
      await speak("Authentication cancelled. Transaction not processed.");
      return false;
    }
    // Other errors: fall back to confirm
    console.warn("WebAuthn error, falling back:", err);
    const confirmed = window.confirm(
      amountLabel
        ? `Authenticate to confirm payment of ${amountLabel}`
        : "Authenticate to confirm this payment"
    );
    if (!confirmed) {
      toast.info("Transaction cancelled");
      await speak("Transaction cancelled.");
    }
    return confirmed;
  }
};
