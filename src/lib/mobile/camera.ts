import { Capacitor } from "@capacitor/core";

export interface PhotoResult {
  dataUrl: string;
  blob: Blob;
  filename: string;
}

async function compressDataUrl(dataUrl: string, maxWidth = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function capturePhoto(slotLabel = "foto"): Promise<PhotoResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      await Camera.requestPermissions();
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
        width: 1280,
      });
      const dataUrl = photo.dataUrl!;
      const filename = `${slotLabel}-${Date.now()}.jpg`;
      return { dataUrl, blob: dataUrlToBlob(dataUrl), filename };
    } catch (err) {
      if (err instanceof Error && err.message?.includes("cancelled")) {
        throw new Error("Foto cancelada");
      }
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("Nenhuma foto selecionada")); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const raw = reader.result as string;
        const compressed = await compressDataUrl(raw);
        const filename = `${slotLabel}-${Date.now()}.jpg`;
        resolve({ dataUrl: compressed, blob: dataUrlToBlob(compressed), filename });
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
