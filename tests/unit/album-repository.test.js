import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createAlbumRepository } from "../../src/data/album-repository";

let repository;

afterEach(async () => {
  await repository?.resetForTests();
  repository = null;
});

describe("album repository", () => {
  it("seeds three visible samples and one hidden memory", async () => {
    repository = createAlbumRepository({ databaseName: `test-${Date.now()}` });
    const snapshot = await repository.initialize();
    expect(snapshot.active).toHaveLength(3);
    expect(snapshot.hidden).toHaveLength(1);
    expect(snapshot.active.every((memory) => memory.isSample)).toBe(true);
  });

  it("persists a profile and a processed photo", async () => {
    repository = createAlbumRepository({ databaseName: `test-${Date.now()}` });
    await repository.initialize();
    await repository.saveProfile({ name: "糯米", birthDate: "2023-11-10" });
    const [record] = await repository.addProcessedPhotos([
      {
        name: "spring.jpg",
        originalBlob: new Blob(["original"], { type: "image/jpeg" }),
        displayBlob: new Blob(["display"], { type: "image/webp" }),
        thumbnailBlob: new Blob(["thumb"], { type: "image/webp" }),
        width: 1600,
        height: 900,
        averageLuma: 0.6,
        warmth: 0.1,
        capturedAt: "2024-03-10",
        latitude: 31.2,
        longitude: 121.4,
      },
    ]);
    const snapshot = await repository.snapshot();
    expect(snapshot.profile).toMatchObject({ name: "糯米", birthDate: "2023-11-10" });
    expect(snapshot.active.find((memory) => memory.id === record.id)).toMatchObject({
      capturedAt: "2024-03-10",
      latitude: 31.2,
      framing: { orientation: "landscape" },
    });
  });

  it("supports hiding, discovering, deleting, restoring and table layout", async () => {
    repository = createAlbumRepository({ databaseName: `test-${Date.now()}` });
    const initial = await repository.initialize();
    const visibleId = initial.active[0].id;
    const hiddenId = initial.hidden[0].id;
    await repository.updateTable(visibleId, { x: 1, y: 2, rotation: 0.2, layer: 9 });
    await repository.softDelete(visibleId);
    expect((await repository.snapshot()).deleted[0].table).toEqual({
      x: 1,
      y: 2,
      rotation: 0.2,
      layer: 9,
    });
    await repository.restore(visibleId);
    await repository.discoverHidden(hiddenId);
    const final = await repository.snapshot();
    expect(final.active.some((memory) => memory.id === visibleId)).toBe(true);
    expect(final.active.some((memory) => memory.id === hiddenId)).toBe(true);
    expect(final.hidden).toHaveLength(0);
  });
});
