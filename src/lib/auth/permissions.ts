import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/driver/today");
  return session;
}

export async function requireDriver() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER") redirect("/admin/dashboard");
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}
