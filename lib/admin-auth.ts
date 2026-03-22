import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

const encoder = new TextEncoder();

type AdminSessionPayload = {
  sub: string;
  email: string;
  name: string;
};

function getSessionKey() {
  if (!env.SESSION_SECRET) {
    throw new AppError(
      "SESSION_NOT_CONFIGURED",
      "SESSION_SECRET is required to use the admin dashboard.",
      500,
    );
  }

  return encoder.encode(env.SESSION_SECRET);
}

export async function createAdminSession(input: AdminSessionPayload) {
  const token = await new SignJWT({
    email: input.email,
    name: input.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionKey());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSessionKey());
    const adminId = verified.payload.sub;

    if (!adminId) {
      return null;
    }

    const admin = await db.adminUser.findFirst({
      where: {
        id: adminId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return admin;
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/login");
  }

  return admin;
}

export async function authenticateAdmin(email: string, password: string) {
  const admin = await db.adminUser.findFirst({
    where: {
      email,
      isActive: true,
    },
  });

  if (!admin) {
    throw new AppError("INVALID_CREDENTIALS", "Credenciales invalidas.", 401);
  }

  const passwordMatches = await compare(password, admin.passwordHash);

  if (!passwordMatches) {
    throw new AppError("INVALID_CREDENTIALS", "Credenciales invalidas.", 401);
  }

  await createAdminSession({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
  });

  return admin;
}
