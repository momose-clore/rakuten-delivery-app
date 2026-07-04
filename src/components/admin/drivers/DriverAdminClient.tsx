"use client";

import { useCallback, useEffect, useState } from "react";

interface DriverRow {
  id: string;
  name: string;
  carioDriverId: string | null;
  vehicleId: string | null;
  companyName: string | null;
  area: string | null;
  loginId: string | null;
  hasAccount: boolean;
  hasPassword: boolean;
}

export function DriverAdminClient() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/drivers");
    setLoading(false);
    if (!res.ok) { setError("取得に失敗しました"); return; }
    const body = await res.json();
    setDrivers(body.drivers ?? []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  function openEdit(d: DriverRow) {
    setEditId(d.id);
    setLoginId(d.loginId ?? "");
    setPassword("");
  }

  async function save(d: DriverRow) {
    if (password.length < 4) { window.alert("パスワードは4文字以上"); return; }
    if (!d.hasAccount && !loginId.trim()) { window.alert("新規はログインIDが必要です"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/drivers/${d.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: loginId.trim() || undefined, password }),
      });
      const body = await res.json();
      if (!res.ok) { window.alert(body.error ?? "設定に失敗しました"); return; }
      window.alert(`設定しました\nログインID: ${loginId.trim() || d.loginId}\nパスワード: ${password}\n\n※パスワードはこの後は表示できません。ドライバーに共有してください。`);
      setEditId(null);
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500">
          登録ドライバーのログインID・CARIO紐付けを管理します。パスワードは暗号化保存のため表示できません（設定・リセットのみ）。
        </p>
        <button onClick={() => void load()} className="ml-auto text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
          再読込
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["ドライバー", "号車", "会社/エリア", "ログインID", "パスワード", "CARIO ID", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drivers.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2 font-medium text-gray-900">{d.name}</td>
                <td className="px-3 py-2">{d.vehicleId ?? "—"}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{d.companyName ?? "—"}<br />{d.area ?? "—"}</td>
                <td className="px-3 py-2">
                  {d.loginId ? <span className="font-mono">{d.loginId}</span> : <span className="text-gray-400">未作成</span>}
                </td>
                <td className="px-3 py-2">
                  {d.hasPassword
                    ? <span className="text-xs text-green-700">設定済み ●●●●</span>
                    : <span className="text-xs text-gray-400">未設定</span>}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{d.carioDriverId ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {editId === d.id ? (
                    <div className="flex flex-col gap-1">
                      <input value={loginId} onChange={(e) => setLoginId(e.target.value)}
                        placeholder="ログインID" className="px-2 py-1 border border-gray-300 rounded text-xs w-40" />
                      <input value={password} onChange={(e) => setPassword(e.target.value)} type="text"
                        placeholder="新パスワード" className="px-2 py-1 border border-gray-300 rounded text-xs w-40" />
                      <div className="flex gap-1">
                        <button onClick={() => save(d)} disabled={busy}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">保存</button>
                        <button onClick={() => setEditId(null)} className="text-xs px-2 py-1 border border-gray-300 rounded">取消</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openEdit(d)}
                      className="text-xs px-2 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50">
                      {d.hasAccount ? "パスワード変更" : "ID/PW作成"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && drivers.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">ドライバーがいません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
