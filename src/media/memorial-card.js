import { calculateAge } from "../domain/memories";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取纪念卡照片"));
    image.src = url;
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  let current = "";
  for (const char of [...text]) {
    if (context.measureText(current + char).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else current += char;
  }
  if (current) lines.push(current);
  return lines;
}

function drawCropped(context, image, box, framing) {
  const imageRatio = image.width / image.height;
  const boxRatio = box.width / box.height;
  const zoom = framing?.crop?.zoom ?? 1;
  let sourceWidth;
  let sourceHeight;
  if (imageRatio > boxRatio) {
    sourceHeight = image.height / zoom;
    sourceWidth = sourceHeight * boxRatio;
  } else {
    sourceWidth = image.width / zoom;
    sourceHeight = sourceWidth / boxRatio;
  }
  const centerX = (framing?.crop?.x ?? 0.5) * image.width;
  const centerY = (framing?.crop?.y ?? 0.5) * image.height;
  const sourceX = Math.max(0, Math.min(image.width - sourceWidth, centerX - sourceWidth / 2));
  const sourceY = Math.max(0, Math.min(image.height - sourceHeight, centerY - sourceHeight / 2));
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    box.x,
    box.y,
    box.width,
    box.height,
  );
}

const FRAME_COLORS = {
  walnut: ["#5a321e", "#b9854d"],
  titanium: ["#17191d", "#a84f42"],
  oak: ["#bc9362", "#66715f"],
};

export async function renderMemorialCard(memory, profile, photoUrl) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 1440);
  gradient.addColorStop(0, "#f5eee2");
  gradient.addColorStop(1, "#dfccb1");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1440);

  const image = await loadImage(photoUrl);
  const box = { x: 100, y: 105, width: 880, height: 790 };
  const [outer, inner] = FRAME_COLORS[memory.framing?.style] ?? FRAME_COLORS.walnut;
  context.fillStyle = outer;
  roundedRect(context, box.x - 34, box.y - 34, box.width + 68, box.height + 68, 18);
  context.fill();
  context.fillStyle = inner;
  roundedRect(context, box.x - 12, box.y - 12, box.width + 24, box.height + 24, 10);
  context.fill();
  context.save();
  roundedRect(context, box.x, box.y, box.width, box.height, 4);
  context.clip();
  drawCropped(context, image, box, memory.framing);
  context.restore();

  context.fillStyle = "#35261d";
  context.font = "700 64px Georgia, serif";
  context.fillText(memory.title || "一段回忆", 100, 1035);
  const age = calculateAge(profile?.birthDate, memory.capturedAt, memory.ageOverrideMonths);
  const facts = [
    memory.capturedAt?.replaceAll("-", "."),
    memory.location,
    age.months == null ? "" : age.label,
  ].filter(Boolean);
  context.fillStyle = "#725843";
  context.font = "34px system-ui, sans-serif";
  context.fillText(facts.join("  ·  "), 100, 1105);

  if (memory.note) {
    context.fillStyle = "#4b382b";
    context.font = "italic 34px Georgia, serif";
    wrapText(context, memory.note, 860)
      .slice(0, 3)
      .forEach((line, index) => context.fillText(line, 100, 1195 + index * 50));
  }

  context.fillStyle = "#9a7046";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText(`🐾 ${profile?.name || "MEMORIES"} · MEMORIES`, 100, 1370);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("纪念卡生成失败"))),
      "image/png",
    ),
  );
}

export async function shareMemorialCard(memory, profile, photoUrl) {
  const blob = await renderMemorialCard(memory, profile, photoUrl);
  const filename = `${memory.title || "回忆"}-纪念卡.png`;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: memory.title, text: "一张珍藏的成长回忆" });
    return { shared: true, filename };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false, filename };
}
