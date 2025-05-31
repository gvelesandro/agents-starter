import { type CookieSerializeOptions, serialize } from 'cookie'; // We'll need to install 'cookie'

export interface SessionData {
  userId: string;
  username: string;
  accessToken?: string; // Optional: store if needed for GitHub API calls
  // consider adding iat (issued at) and exp (expires at) if not relying on cookie's Max-Age/Expires
}

const SESSION_COOKIE_NAME = '__session';
// Default cookie options - Secure should be true in production
const defaultCookieOptions: CookieSerializeOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Needs NODE_ENV to be set appropriately
  path: '/',
  sameSite: 'lax', // CSRF protection
  maxAge: 60 * 60 * 24 * 7, // 1 week
};

// This function will be more complex if we add signing/encryption
// For now, it's a simple JSON stringification and Base64 encoding
export function createSessionCookie(sessionData: SessionData, options?: CookieSerializeOptions): string {
  const finalOptions = { ...defaultCookieOptions, ...options };
  const stringifiedData = JSON.stringify(sessionData);
  // In a real app, you'd sign or encrypt this value using SESSION_SECRET
  const cookieValue = Buffer.from(stringifiedData).toString('base64');
  return serialize(SESSION_COOKIE_NAME, cookieValue, finalOptions);
}

export async function getSession(request: Request): Promise<SessionData | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  const sessionCookie = cookies.find(cookie => cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!sessionCookie) {
    return null;
  }

  const cookieValue = sessionCookie.split('=')[1];
  if (!cookieValue) {
    return null;
  }

  try {
    // In a real app, you'd verify the signature or decrypt this value
    const decodedValue = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const sessionData = JSON.parse(decodedValue) as SessionData;
    // Here you might add checks for session expiry if you stored it in the sessionData
    return sessionData;
  } catch (error) {
    console.error('Failed to parse session cookie:', error);
    return null;
  }
}

export function clearSessionCookie(): string {
  return serialize(SESSION_COOKIE_NAME, '', {
    ...defaultCookieOptions,
    maxAge: 0, // Expire immediately
    expires: new Date(0), // Set expiry date in the past
  });
}
