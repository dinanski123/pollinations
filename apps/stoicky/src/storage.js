const DB_NAME = "stoicky-device-storage";
const DB_VERSION = 1;
const STORE_NAME = "assets";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support device storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open device storage."));
  });
}

export async function saveAsset(id, blob, filename) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id,
      blob,
      filename,
      mime: blob.type || "application/octet-stream",
      createdAt: Date.now()
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Could not save the file."));
  });
  db.close();
  return id;
}

export async function getAsset(id) {
  if (!id) return null;
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read the saved file."));
  });
  db.close();
  return value;
}

export async function deleteAssets(ids) {
  const validIds = ids.filter(Boolean);
  if (!validIds.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    validIds.forEach(id => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Could not delete saved files."));
  });
  db.close();
}

export async function blobFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not save the generated file.");
  return response.blob();
}

export function safeFilename(name) {
  return (name || "stoicky-video")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "stoicky-video";
}

export async function requestPersistentStorage() {
  try {
    return await navigator.storage?.persist?.();
  } catch {
    return false;
  }
}
