// 화면에서 서버 API를 부른다. 서버가 보낸 오류 메시지를 그대로 보여 줄 수 있게 ApiError로 던진다.
export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function call<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'error', data.message ?? '잠시 후 다시 시도해 주세요.', res.status);
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요.');

/** 사진을 긴 변 maxSide px JPEG로 줄인다 (올리기 전에 화면에서) */
export async function shrinkImage(file: File, maxSide: number, quality = 0.85): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}
