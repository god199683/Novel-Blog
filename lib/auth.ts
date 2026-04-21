import { SignJWT, jwtVerify } from "jose";

export type Session = {
  userId: string;
  username: string;
  displayName: string;
};

const SECRET = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
};

export async function createSession(session: Session): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET());
}

export async function verifySession(
  token: string | undefined
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET());
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      displayName: payload.displayName as string,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";
