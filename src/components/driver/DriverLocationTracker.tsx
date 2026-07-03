"use client";

/**
 * ドライバー現在地トラッカー（GPS リアルタイム表示用）
 *
 * - ブラウザ標準 Geolocation API で現在地を取得（Google 有料APIは不使用・課金なし）
 * - watchPosition で移動を監視し、一定間隔で /api/driver/location に送信
 * - 画面レイアウトには一切影響しない不可視コンポーネント（return null）
 * - 位置情報（緯度経度）は個人情報のため console.log しない
 * - 権限拒否・非対応時は静かに何もしない
 *
 * driver layout にマウントする前提。ドライバーがアプリを開いている間だけ送信する。
 */

import { useEffect, useRef } from "react";

const SEND_INTERVAL_MS = 12_000; // 最短送信間隔（サーバー負荷・バッテリー配慮）

export function DriverLocationTracker() {
  const lastSentRef = useRef(0);
  const inflightRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = async (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < SEND_INTERVAL_MS) return; // 間引き
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

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        void send(pos);
      },
      () => {
        // 権限拒否・タイムアウト等は静かに無視
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return null;
}
