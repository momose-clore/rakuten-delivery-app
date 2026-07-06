import { MobileCameraImportPage } from "@/components/import/mobile/MobileCameraImportPage";

/** ドライバー用 配送表カメラOCR（既存カメラOCR機能を再利用） */
export default function DriverCameraPage() {
  return (
    <MobileCameraImportPage
      doneHref="/driver/today"
      doneLabel="本日の配送を見る →"
      doneNote="配送表を読み込み、本日の配送に反映しました。"
      backHref="/driver/today"
      autoStart
    />
  );
}
