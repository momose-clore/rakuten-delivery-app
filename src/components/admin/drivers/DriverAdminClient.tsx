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

interface CarioDriver {
  carioDriverId: string;
  name: string;
  vehicleId: string | null;
  area: string | null;
  alreadyRegistered: boolean;
  registeredAs: string | null;
}

export function DriverAdminClient() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 新規ドライバー登録
  const [adding, setAdding] = useState(false);
  const [carioList, setCarioList] = useState<CarioDriver[]>([]);
  const [carioLoading, setCarioLoading] = useState(false);
  const [carioErr, setCarioErr] = useState("");
  const [nName, setNName] = useState("");
  const [nCario, setNCario] = useState(""); // 選択中の carioDriverId
  const [nVehicle, setNVehicle] = useState("");
  const [nLoginId, setNLoginId] = useState("");
  const [nPassword, setNPassword] = useState("");

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

  const openAdd = useCallback(async () => {
    setAdding(true);
    setNName(""); setNCario(""); setNVehicle(""); setNLoginId(""); setNPassword("");
    setCarioErr("");
    setCarioLoading(true);
    try {
      const res = await fetch("/api/admin/cario-drivers");
      const body = await res.json();
      setCarioList(body.drivers ?? []);
      if (body.error) setCarioErr(body.error);
    } catch {
      setCarioErr("CARIOドライバー一覧の取得に失敗しました");
    } finally {
      setCarioLoading(false);
    }
  }, []);

  // CARIO候補を選ぶと氏名・号車・紐付けIDを自動補完
  function pickCario(carioDriverId: string) {
    setNCario(carioDriverId);
    const c = carioList.find((x) => x.carioDriverId === carioDriverId);
    if (c) {
      if (c.name) setNName(c.name);
      if (c.vehicleId) setNVehicle(c.vehicleId);
    }
  }

  async function createDriver() {
    if (!nName.trim()) { window.alert("氏名を入力してください"); return; }
    if (nLoginId.trim() && nPassword.length < 4) { window.alert("パスワードは4文字以上"); return; }
    if (nPassword && !nLoginId.trim()) { window.alert("パスワードを設定するにはログインIDが必要です"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nName.trim(),
          carioDriverId: nCario || undefined,
          vehicleId: nVehicle.trim() || undefined,
          loginId: nLoginId.trim() || undefined,
          password: nPassword || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) { window.alert(body.error ?? "登録に失敗しました"); return; }
      window.alert(
        `登録しました：${nName.trim()}` +
        (nCario ? `\nCARIO紐付け: ${nCario}` : "\n（CARIO未紐付け）") +
        (nLoginId.trim() ? `\nログインID: ${nLoginId.trim()}\nパスワード: ${nPassword}\n※パスワードはこの後表示できません。` : "")
      );
      setAdding(false);
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
        <button onClick={() => void openAdd()} className="ml-auto text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          ＋ 新規ドライバー登録
        </button>
        <button onClick={() => void load()} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
          再読込
        </button>
      </div>

      {/* 新規ドライバー登録フォーム（CARIOから選んで紐付け） */}
      {adding && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">新規ドライバー登録</h2>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 underline">閉じる</button>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">CARIOドライバーと紐付け</label>
            {carioLoading ? (
              <p className="text-xs text-gray-400">CARIOから取得中...</p>
            ) : (
              <select value={nCario} onChange={(e) => pickCario(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                <option value="">（紐付けなしで登録）</option>
                {carioList.map((c) => (
                  <option key={c.carioDriverId} value={c.carioDriverId} disabled={c.alreadyRegistered}>
                    {c.name}{c.vehicleId ? `／${c.vehicleId}` : ""}
                    {c.alreadyRegistered ? `（登録済:${c.registeredAs}）` : ""}
                    {` … ${c.carioDriverId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
            {carioErr && <p className="text-xs text-amber-600">{carioErr}</p>}
            <p className="text-[11px] text-gray-400">同名が複数ある場合は末尾のID（先頭8桁）で区別してください。登録済みは選べません。</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">氏名 *</label>
              <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="百瀬璃玖"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">号車（任意）</label>
              <input value={nVehicle} onChange={(e) => setNVehicle(e.target.value)} placeholder="3"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">ログインID（任意）</label>
              <input value={nLoginId} onChange={(e) => setNLoginId(e.target.value)} placeholder="momose"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">パスワード（任意・4文字以上）</label>
              <input value={nPassword} onChange={(e) => setNPassword(e.target.value)} type="text" placeholder="driver1234"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => void createDriver()} disabled={busy}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50">登録する</button>
            <button onClick={() => setAdding(false)} className="text-sm px-4 py-1.5 border border-gray-300 rounded">やめる</button>
          </div>
        </div>
      )}

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
