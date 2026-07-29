import Dexie from "dexie";
import {
  chooseFrame,
  createMemoryId,
  deletedMemories,
  hiddenMemories,
  toDateInput,
  visibleMemories,
} from "../domain/memories";

const SAMPLE_IDS = ["sample-meadow", "sample-rain", "sample-nap", "sample-hidden"];

function sampleMemory(basePath, input) {
  return {
    id: input.id,
    title: input.title,
    capturedAt: input.capturedAt,
    location: input.location,
    latitude: null,
    longitude: null,
    note: input.note,
    ageOverrideMonths: input.ageOverrideMonths,
    visibility: input.visibility ?? "visible",
    discoveredAt: null,
    deletedAt: null,
    isSample: true,
    photo: {
      kind: "url",
      url: `${basePath}${input.url}`,
      width: input.width ?? 1536,
      height: input.height ?? 1024,
      originalBlob: null,
      displayBlob: null,
      thumbnailBlob: null,
      mimeType: "image/png",
    },
    framing: chooseFrame({
      width: input.width ?? 1536,
      height: input.height ?? 1024,
      averageLuma: input.luma,
      warmth: input.warmth,
    }),
    table: input.table,
    createdAt: input.capturedAt,
    updatedAt: new Date().toISOString(),
  };
}

function samples(basePath) {
  return [
    sampleMemory(basePath, {
      id: "sample-meadow",
      title: "奔向晴天",
      capturedAt: "2024-03-10",
      location: "崇明东滩草地",
      ageOverrideMonths: 4,
      note: "第一次在草地上放开牵引绳，你一路追着风跑，也一路回头确认我还在。",
      url: "/shiba-meadow.png",
      luma: 0.68,
      warmth: 0.2,
      table: { x: -1.6, y: 0.35, rotation: -0.16, layer: 1 },
    }),
    sampleMemory(basePath, {
      id: "sample-rain",
      title: "雨夜散步",
      capturedAt: "2024-07-18",
      location: "上海法租界",
      ageOverrideMonths: 8,
      note: "雨后的街灯落在你湿漉漉的鼻尖上。谢谢你陪我把普通的夜晚走成了故事。",
      url: "/shiba-rainy-night.png",
      luma: 0.27,
      warmth: -0.1,
      table: { x: 0.1, y: -0.2, rotation: 0.11, layer: 3 },
    }),
    sampleMemory(basePath, {
      id: "sample-nap",
      title: "午后小憩",
      capturedAt: "2025-01-05",
      location: "家中窗边",
      ageOverrideMonths: 14,
      note: "你抱着最喜欢的蓝色兔子睡着了。阳光很慢，我们也不着急长大。",
      url: "/shiba-sunny-nap.png",
      luma: 0.78,
      warmth: 0.15,
      table: { x: 1.5, y: 0.3, rotation: -0.08, layer: 2 },
    }),
    sampleMemory(basePath, {
      id: "sample-hidden",
      title: "清晨的秘密",
      capturedAt: "2024-05-02",
      location: "家中地毯",
      ageOverrideMonths: 6,
      note: "你以为大家都还没醒，其实晨光已经偷偷把这份可爱收藏起来了。",
      url: "/warm-home-morning.png",
      luma: 0.7,
      warmth: 0.25,
      visibility: "hidden",
      table: { x: 0, y: 0, rotation: 0, layer: 0 },
    }),
  ];
}

class AlbumDatabase extends Dexie {
  constructor(name) {
    super(name);
    this.version(1).stores({
      memories: "id, capturedAt, visibility, deletedAt, isSample, updatedAt",
      profile: "id",
      settings: "id",
    });
  }
}

export function createAlbumRepository({
  databaseName = "memories-3d-album",
  basePath = "",
} = {}) {
  const db = new AlbumDatabase(databaseName);

  async function initialize() {
    await db.open();
    const existing = await db.memories.bulkGet(SAMPLE_IDS);
    const missing = samples(basePath).filter((_, index) => !existing[index]);
    if (missing.length) await db.memories.bulkPut(missing);
    if (!(await db.settings.get("album"))) {
      await db.settings.put({ id: "album", easterMisses: 0, maxMemories: 200 });
    }
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => false);
    }
    return snapshot();
  }

  async function snapshot() {
    const [profile, memories, settings] = await Promise.all([
      db.profile.get("primary"),
      db.memories.toArray(),
      db.settings.get("album"),
    ]);
    return {
      profile: profile ?? null,
      active: visibleMemories(memories),
      hidden: hiddenMemories(memories),
      deleted: deletedMemories(memories),
      settings: settings ?? { id: "album", easterMisses: 0, maxMemories: 200 },
    };
  }

  async function saveProfile({ name, birthDate }) {
    await db.profile.put({
      id: "primary",
      name: name.trim(),
      birthDate: toDateInput(birthDate),
      updatedAt: new Date().toISOString(),
    });
  }

  async function addProcessedPhotos(processedPhotos) {
    const count = await db.memories.filter((memory) => !memory.deletedAt).count();
    if (count + processedPhotos.length > 204) {
      throw new Error("本地相册最多保存 200 条用户回忆");
    }
    const now = new Date().toISOString();
    const records = processedPhotos.map((photo, index) => ({
      id: createMemoryId(),
      title: photo.name.replace(/\.[^.]+$/, "") || "未命名回忆",
      capturedAt: photo.capturedAt,
      location: "",
      latitude: photo.latitude,
      longitude: photo.longitude,
      note: "",
      ageOverrideMonths: null,
      visibility: "visible",
      discoveredAt: null,
      deletedAt: null,
      isSample: false,
      photo: {
        kind: "blob",
        originalBlob: photo.originalBlob,
        displayBlob: photo.displayBlob,
        thumbnailBlob: photo.thumbnailBlob,
        width: photo.width,
        height: photo.height,
        mimeType: photo.originalBlob.type,
      },
      framing: chooseFrame(photo),
      table: {
        x: ((index % 5) - 2) * 0.72,
        y: (Math.floor(index / 5) % 3 - 1) * 0.55,
        rotation: ((index * 29) % 20 - 10) / 50,
        layer: Date.now() + index,
      },
      createdAt: now,
      updatedAt: now,
    }));
    await db.memories.bulkAdd(records);
    return records;
  }

  async function updateMemory(id, patch) {
    await db.memories.update(id, { ...patch, updatedAt: new Date().toISOString() });
  }

  async function updateTable(id, table) {
    await db.memories.update(id, { table, updatedAt: new Date().toISOString() });
  }

  async function softDelete(id) {
    await updateMemory(id, { deletedAt: new Date().toISOString() });
  }

  async function restore(id) {
    await updateMemory(id, { deletedAt: null });
  }

  async function purge(id) {
    await db.memories.delete(id);
  }

  async function discoverHidden(id) {
    await updateMemory(id, {
      visibility: "visible",
      discoveredAt: new Date().toISOString(),
    });
    await setEasterMisses(0);
  }

  async function setEasterMisses(easterMisses) {
    await db.settings.update("album", { easterMisses });
  }

  async function resetForTests() {
    await db.delete();
  }

  return {
    initialize,
    snapshot,
    saveProfile,
    addProcessedPhotos,
    updateMemory,
    updateTable,
    softDelete,
    restore,
    purge,
    discoverHidden,
    setEasterMisses,
    resetForTests,
  };
}
