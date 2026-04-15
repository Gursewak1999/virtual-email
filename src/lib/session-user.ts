import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}
