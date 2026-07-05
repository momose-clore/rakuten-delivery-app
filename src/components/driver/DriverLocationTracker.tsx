"use client";

/**
 * ドライバー現在地トラッカー（GPS リアルタイム表示用）
 *
 * - ブラウザ標準 Geolocation API で現在地を取得（Google 有料APIは不使用・課金なし）
 * - 一定間隔(ハートビート)で getCurrentPosition を強制取得し /api/driver/location へ送信
 * - watchPosition も併用し移動時は即時反映
 * - GPS状態を小さなバッジで表示（許可なし/取得中/送信済み）＝無音失敗を可視化
 * - Wake Lock で画面スリープを抑止
 * - 位置情報（緯度経度）は個人情報のため console.log しない
 *
 * driver layout にマウントする前提。
 */

import { useEffect, useRef, useState, useCallback } from "react";

// GPS/interval コールバック内での setState（非同期・同期カスケードではない）を許容
/* eslint-disable react-hooks/set-state-in-effect */

const HEARTBEAT_MS = 12_000;
const MIN_GAP_MS = 8_000;

type GpsState = "init" | "ok" | "denied" | "unavailable" | "timeout" | "unsupported";

export function DriverLocationTracker() {
  const lastSentRef = useRef(0);
  const lastSentAtRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  const sendRef = useRef<((pos: GeolocationPosition) => Promise<void>) | null>(null);
  const [state, setState] = useState<GpsState>("init");
  const [agoSec, setAgoSec] = useState<number | null>(null);

  const requestOnce = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("unsupported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => void sendRef.current?.(pos),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setState("unavailable");
        else setState("timeout");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("unsupported"); return; }

    const send = async (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < MIN_GAP_MS) return;
      if (inflightRef.current) return;
      inflightRef.current = true;
      lastSentRef.current = now;
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      try {
        const res = await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: latitude,
            lng: longitude,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            heading: heading != null && Number.isFinite(heading) ? heading : null,
            speed: speed != null && Number.isFinite(speed) ? speed : null,
            recordedAt: new Date(pos.timestamp).toISOString(),
          }),
          keepalive: true,
        });
        if (res.ok) { lastSentAtRef.current = Date.now(); setState("ok"); setAgoSec(0); }
      } catch {
        /* ネットワーク失敗は無視（次回でリカバリ） */
      } finally {
        inflightRef.current = false;
      }
    };
    sendRef.current = send;

    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setState("denied");
      else if (err.code === err.POSITION_UNAVAILABLE) setState("unavailable");
      else setState("timeout");
    };
    const tickFn = () => navigator.geolocation.getCurrentPosition(
      (pos) => void send(pos), onErr,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    tickFn();
    const heartbeat = setInterval(tickFn, HEARTBEAT_MS);
    const watchId = navigator.geolocation.watchPosition((pos) => void send(pos), onErr,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
    // 表示用：最終送信からの経過秒を更新
    const display = setInterval(() => {
      const t = lastSentAtRef.current;
      setAgoSec(t == null ? null : Math.round((Date.now() - t) / 1000));
    }, 5_000);

    let wakeLock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        }
      } catch { /* 無視 */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") { void acquire(); tickFn(); } };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(heartbeat);
      clearInterval(display);
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisible);
      try { void wakeLock?.release(); } catch { /* 無視 */ }
    };
  }, []);

  let bg = "#6b7280", label = "GPS 取得中…";
  if (state === "ok" && agoSec != null) {
    bg = agoSec <= 30 ? "#157347" : "#B45309";
    label = `GPS 送信 ${agoSec < 60 ? `${agoSec}秒前` : `${Math.round(agoSec / 60)}分前`}`;
  } else if (state === "denied") {
    bg = "#C81E1E"; label = "位置情報OFF ▶ タップして許可";
  } else if (state === "unavailable") {
    bg = "#C81E1E"; label = "位置を取得できません";
  } else if (state === "timeout") {
    bg = "#B45309"; label = "GPS 取得に時間がかかっています";
  } else if (state === "unsupported") {
    bg = "#C81E1E"; label = "この端末はGPS非対応";
  }

  return (
    <button
      type="button"
      onClick={requestOnce}
      style={{
        position: "fixed", left: 8, bottom: 8, zIndex: 9999,
        background: bg, color: "#fff", border: "none", borderRadius: 9999,
        padding: "6px 12px", fontSize: 12, fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      }}
    >
      {label}
    </button>
  );
}
