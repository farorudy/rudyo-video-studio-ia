/**
 * Construit un WAV PCM réellement décodable par le navigateur.
 * Les stubs tronqués ne suffisent plus : l'interface lit la durée côté client
 * avant d'appeler le devis, et rejette tout fichier qu'elle ne sait pas décoder.
 */
export function makeWav(seconds: number, sampleRate = 8000): Buffer {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const dataLength = samples * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);          // taille du bloc fmt
  buffer.writeUInt16LE(1, 20);           // PCM
  buffer.writeUInt16LE(1, 22);           // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);           // block align
  buffer.writeUInt16LE(16, 34);          // bits par échantillon
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin((index / sampleRate) * 440 * 2 * Math.PI) * 8000), 44 + index * 2);
  }
  return buffer;
}

export const wavFile = (seconds: number, name = "chanson.wav") => ({
  name,
  mimeType: "audio/wav",
  buffer: makeWav(seconds),
});

/** JPEG minimal valide, accepté par le contrôle de type de l'interface. */
export const jpegFile = {
  name: "artiste.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  ),
};
