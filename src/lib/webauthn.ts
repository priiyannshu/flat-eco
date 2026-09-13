/**
 * WebAuthn / Passkeys Utility for FlatEco
 * Powers biometric authentication (Face ID on Apple, Touch ID, Android Biometrics, Windows Hello)
 */

export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && window.PublicKeyCredential !== undefined;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function createPasskeyCredential(options: any): Promise<any> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys / WebAuthn is not supported in this browser.');
  }

  // Deep copy to prevent modifying original
  const publicKey: any = { ...options };

  // Convert challenge to BufferSource
  if (typeof publicKey.challenge === 'string') {
    publicKey.challenge = base64URLToBuffer(publicKey.challenge);
  }

  // Convert user.id to BufferSource
  if (publicKey.user && typeof publicKey.user.id === 'string') {
    publicKey.user.id = new TextEncoder().encode(publicKey.user.id);
  }

  // Exclude credentials conversion if present
  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((c: any) => ({
      ...c,
      id: typeof c.id === 'string' ? base64URLToBuffer(c.id) : c.id
    }));
  }

  // Invoke native browser biometric prompt (Face ID / Touch ID / Android)
  const credential = (await navigator.credentials.create({ publicKey })) as any;
  if (!credential) {
    throw new Error('Biometric passkey creation was cancelled or failed.');
  }

  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
      attestationObject: bufferToBase64URL(credential.response.attestationObject)
    }
  };
}

export async function getPasskeyAssertion(options: any): Promise<any> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys / WebAuthn is not supported in this browser.');
  }

  const publicKey: any = { ...options };

  if (typeof publicKey.challenge === 'string') {
    publicKey.challenge = base64URLToBuffer(publicKey.challenge);
  }

  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
      ...c,
      id: typeof c.id === 'string' ? base64URLToBuffer(c.id) : c.id
    }));
  }

  // Invoke native browser biometric scan (Face ID / Touch ID)
  const assertion = (await navigator.credentials.get({ publicKey })) as any;
  if (!assertion) {
    throw new Error('Biometric verification cancelled.');
  }

  return {
    id: assertion.id,
    rawId: bufferToBase64URL(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
      authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
      signature: bufferToBase64URL(assertion.response.signature),
      userHandle: assertion.response.userHandle ? bufferToBase64URL(assertion.response.userHandle) : null
    }
  };
}
