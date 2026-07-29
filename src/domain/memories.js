export const FRAME_STYLES = ["walnut", "titanium", "oak"];
export const FRAME_ORIENTATIONS = ["landscape", "portrait", "square"];

const pad = (value) => String(value).padStart(2, "0");

export function toDateInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function calculateAge(birthDate, capturedAt, overrideMonths = null) {
  if (Number.isFinite(overrideMonths) && overrideMonths >= 0) {
    return { months: Math.round(overrideMonths), label: formatAge(overrideMonths) };
  }
  if (!birthDate || !capturedAt) return { months: null, label: "待补充" };
  const birth = new Date(`${toDateInput(birthDate)}T00:00:00`);
  const capture = new Date(`${toDateInput(capturedAt)}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(capture.getTime()) || capture < birth) {
    return { months: null, label: "待补充" };
  }
  let months =
    (capture.getFullYear() - birth.getFullYear()) * 12 +
    capture.getMonth() -
    birth.getMonth();
  if (capture.getDate() < birth.getDate()) months -= 1;
  return { months: Math.max(0, months), label: formatAge(Math.max(0, months)) };
}

export function formatAge(months) {
  if (!Number.isFinite(months)) return "待补充";
  const rounded = Math.max(0, Math.round(months));
  if (rounded < 12) return `${rounded}个月`;
  const years = Math.floor(rounded / 12);
  const rest = rounded % 12;
  return rest ? `${years}岁${rest}个月` : `${years}岁`;
}

export function groupMemoriesByMonth(memories) {
  const dated = memories
    .filter((memory) => memory.capturedAt)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const pending = memories.filter((memory) => !memory.capturedAt);
  const groups = [];
  for (const memory of dated) {
    const key = memory.capturedAt.slice(0, 7);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: `${key.slice(0, 4)}年${Number(key.slice(5))}月`, memories: [] };
      groups.push(group);
    }
    group.memories.push(memory);
  }
  if (pending.length) groups.push({ key: "pending", label: "待整理", memories: pending });
  return groups;
}

export function chooseFrame({ width, height, averageLuma = 0.5, warmth = 0 }) {
  const ratio = width / Math.max(1, height);
  const orientation = ratio > 1.18 ? "landscape" : ratio < 0.84 ? "portrait" : "square";
  let style = "walnut";
  if (averageLuma < 0.38) style = "titanium";
  else if (warmth < -0.04 || averageLuma > 0.72) style = "oak";
  return {
    style,
    orientation,
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  };
}

export function determineLightMode(hour) {
  return hour >= 7 && hour < 18 ? "day" : "night";
}

export function shouldDropHidden(misses, randomValue = Math.random()) {
  return misses >= 2 || randomValue < 0.35;
}

export function visibleMemories(memories) {
  return memories
    .filter((memory) => !memory.deletedAt && memory.visibility !== "hidden")
    .sort((a, b) => {
      if (!a.capturedAt) return 1;
      if (!b.capturedAt) return -1;
      return a.capturedAt.localeCompare(b.capturedAt);
    });
}

export function hiddenMemories(memories) {
  return memories.filter((memory) => !memory.deletedAt && memory.visibility === "hidden");
}

export function deletedMemories(memories) {
  return memories.filter((memory) => Boolean(memory.deletedAt));
}

export function createMemoryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
