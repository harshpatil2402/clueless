import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  /** Google's stable id for the account. */
  sub: string;
  name: string;
}

/** Resolves to the account behind a Google ID token, or null if the token is not valid for this app. */
export type GoogleVerifier = (credential: string) => Promise<GoogleProfile | null>;

export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (credential) => {
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) return null;
      return { sub: payload.sub, name: payload.given_name ?? payload.name ?? 'Player' };
    } catch {
      return null;
    }
  };
}
