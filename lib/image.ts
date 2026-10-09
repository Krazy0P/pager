export async function centerCropSquare(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read image"));
    });

    const size = Math.min(image.naturalWidth, image.naturalHeight);
    if (!size) throw new Error("Could not read image dimensions");

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare image");

    const offsetX = (image.naturalWidth - size) / 2;
    const offsetY = (image.naturalHeight - size) / 2;
    context.drawImage(
      image,
      offsetX,
      offsetY,
      size,
      size,
      0,
      0,
      size,
      size,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Could not process image"));
        },
        file.type || "image/jpeg",
        0.92,
      );
    });

    return new File([blob], file.name, {
      type: blob.type || file.type || "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
