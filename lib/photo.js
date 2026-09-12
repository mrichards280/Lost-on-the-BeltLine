// Hunt day is a phone on cell service in a park. A raw 12MP photo is several
// megabytes and a proof shot only ever gets looked at as a thumbnail at HQ, so
// downscale in the browser before it ever goes near the network.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export async function downscaleToDataUrl(file) {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

async function loadBitmap(file) {
  // createImageBitmap applies EXIF orientation on modern mobile browsers, so
  // portrait photos do not come out sideways at HQ.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read that photo'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
