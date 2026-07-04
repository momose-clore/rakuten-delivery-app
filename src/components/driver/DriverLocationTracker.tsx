"use client";

/**
 * ドライバー現在地トラッカー（GPS リアルタイム表示用）
 *
 * - ブラウザ標準 Geolocation API で現在地を取得（Google 有料APIは不使用・課金なし）
 * - 一定間隔(ハートビート)で getCurrentPosition を強制取得し /api/driver/location へ送信
 *   → watchPosition だけだと「動いた時しか発火しない」ため停車中に更新が止まる問題を回避
 * - watchPosition も併用し、移動時は即時反映
 * - Wake Lock で画面スリープを抑止（アプリを開いている間の取得継続性を上げる）
 * - 画面レイアウトには一切影響しない不可視コンポーネント（return null）
 * - 位置情報（緯度経度）は個人情報のため console.log しない
 * - 権限拒否・非対応時は静かに何もしない
 *
 * driver layout にマウントする前提。ドライバーがアプリを開いている間だけ送信する。
 */

import { useEffect, useRef } from "react";

const HEARTBEAT_MS = 12_000; // 定期取得の間隔（停車中でもこの間隔で更新）
const MIN_GAP_MS = 8_000;    // 連続送信の最短間隔（watch と heartbeat の重複抑制）

export function DriverLocationTracker() {
  const lastSentRef = useRef(0);
  const inflightRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = async (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < MIN_GAP_MS) return; // 間引き
      if (inflightRef.current) return;
      inflightRef.current = true;
      lastSentRef.current = now;

      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      try {
        await fetch("/api/driver/location", {
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
      } catch {
        // ネットワーク失敗は無視（次回送信でリカバリ）。位置情報はログに残さない。
      } finally {
        inflightRef.current = false;
      }
    };

    // 定期ハートビート: 停車中でも一定間隔で現在地を取り直して送信
    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void send(pos),
        () => {}, // 権限拒否・タイムアウト等は静かに無視
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
    };
    tick(); // マウント直後に1回
    const heartbeat = setInterval(tick, HEARTBEAT_MS);

    // 移動時は即時反映（watchPosition）
    const watchId = navigator.geolocation.watchPosition(
      (pos) => void send(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    // 画面スリープ抑止（対応ブラウザのみ）。バックグラウンド化で解放されるため復帰時に再取得。
    let wakeLock: WakeLockSentinel | null = null;
    const acquireWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        }
      } catch {
        // 未対応・失敗は無視
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
        tick(); // 復帰時に即取得
      }
    };
    void acquireWakeLock();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(heartbeat);
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisible);
      try {
        void wakeLock?.release();
      } catch {
        /* 無視 */
      }
    };
  }, []);

  return null;
}
