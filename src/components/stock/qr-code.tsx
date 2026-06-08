import Image from "next/image";

export function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  return (
    <Image
      src={src}
      alt={`QR Code ${value}`}
      width={size}
      height={size}
      unoptimized
      className="rounded-[8px] border border-line bg-white p-1.5"
    />
  );
}
