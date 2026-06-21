"use client";
import { QRCodeSVG } from "qrcode.react";

export function Qr({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-lg">
      <QRCodeSVG value={value} size={size} />
    </div>
  );
}
