import { requireDriver } from "@/lib/auth/permissions";
import LogoutButton from "@/components/common/LogoutButton";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDriver();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400">楽天スーパー配送</p>
          <p className="text-sm font-semibold text-gray-900">
            {session.user.name ?? session.user.email}
          </p>
        </div>
        <LogoutButton />
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
