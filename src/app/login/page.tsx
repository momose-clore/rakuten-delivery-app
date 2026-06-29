import { LoginForm } from "@/components/common/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-md px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              楽天スーパー配送
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              管理者・ドライバーログイン
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
