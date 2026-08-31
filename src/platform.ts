export function cloneData<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function randomUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const valueByByte = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
  return `${valueByByte.slice(0, 4).join('')}-${valueByByte.slice(4, 6).join('')}-${valueByByte.slice(6, 8).join('')}-${valueByByte.slice(8, 10).join('')}-${valueByByte.slice(10).join('')}`;
}
