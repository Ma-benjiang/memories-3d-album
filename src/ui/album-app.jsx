"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateAge,
  determineLightMode,
  groupMemoriesByMonth,
  shouldDropHidden,
} from "../domain/memories";
import { createAlbumRepository } from "../data/album-repository";
import { processPhotoFiles } from "../media/process-photo";
import { shareMemorialCard } from "../media/memorial-card";
import { ThreeGallery } from "./three-gallery";

const EMPTY_SNAPSHOT = {
  profile: null,
  active: [],
  hidden: [],
  deleted: [],
  settings: { easterMisses: 0, maxMemories: 200 },
};

function useMemoryUrls(memories) {
  const [views, setViews] = useState([]);
  useEffect(() => {
    const createdUrls = [];
    const next = memories.map((memory) => {
      if (memory.photo.kind === "url") {
        return {
          ...memory,
          imageUrl: memory.photo.url,
          fullImageUrl: memory.photo.url,
        };
      }
      const imageBlob =
        memory.photo.thumbnailBlob || memory.photo.displayBlob || memory.photo.originalBlob;
      const fullBlob = memory.photo.displayBlob || memory.photo.originalBlob;
      const imageUrl = URL.createObjectURL(imageBlob);
      const fullImageUrl = fullBlob === imageBlob ? imageUrl : URL.createObjectURL(fullBlob);
      createdUrls.push(imageUrl);
      if (fullImageUrl !== imageUrl) createdUrls.push(fullImageUrl);
      return { ...memory, imageUrl, fullImageUrl };
    });
    setViews(next);
    return () => createdUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [memories]);
  return views;
}

function Icon({ children }) {
  return <span aria-hidden="true">{children}</span>;
}

function ProfileModal({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? "");
  return (
    <div className="modal-layer" data-testid="profile-modal">
      <form
        className="sheet profile-sheet"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, birthDate });
        }}
      >
        <div className="eyebrow">DOG PROFILE</div>
        <h2>先认识一下主角</h2>
        <p>出生日期用于自动计算每张照片里的年龄，之后可以随时修改。</p>
        <label>
          小狗名字
          <input
            data-testid="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：糯米"
            required
          />
        </label>
        <label>
          出生日期
          <input
            data-testid="profile-birth-date"
            type="text"
            inputMode="numeric"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            placeholder="YYYY-MM-DD"
            pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
            maxLength="10"
            title="请输入 YYYY-MM-DD 格式的日期"
            required
          />
        </label>
        <div className="sheet-actions">
          {profile && (
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
          )}
          <button data-testid="save-profile" className="button primary" type="submit">
            保存档案
          </button>
        </div>
      </form>
    </div>
  );
}

function MemoryEditor({ memory, profile, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    title: memory.title,
    capturedAt: memory.capturedAt ?? "",
    location: memory.location ?? "",
    note: memory.note ?? "",
    visibility: memory.visibility,
    framing: {
      ...memory.framing,
      crop: { ...memory.framing.crop },
    },
  }));
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateFraming = (key, value) =>
    setDraft((current) => ({
      ...current,
      framing: { ...current.framing, [key]: value },
    }));
  const updateCrop = (key, value) =>
    setDraft((current) => ({
      ...current,
      framing: {
        ...current.framing,
        crop: { ...current.framing.crop, [key]: Number(value) },
      },
    }));
  const age = calculateAge(profile?.birthDate, draft.capturedAt, memory.ageOverrideMonths);
  return (
    <div className="modal-layer" data-testid="memory-editor">
      <form
        className="sheet editor-sheet paper-document-3d"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <span className="album-paper-surface" aria-hidden="true" />
        <span className="paper-thickness" aria-hidden="true" />
        <span className="paper-seam" aria-hidden="true" />
        <span className="paper-curl" aria-hidden="true" />
        <button className="sheet-close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <div className="editor-preview-column">
          <div
            className={`crop-preview ${draft.framing.orientation} frame-${draft.framing.style}`}
            style={{
              backgroundImage: `url("${memory.fullImageUrl}")`,
              backgroundPosition: `${draft.framing.crop.x * 100}% ${draft.framing.crop.y * 100}%`,
              backgroundSize: `${draft.framing.crop.zoom * 100}%`,
            }}
          >
            <i className="photo-corner photo-corner-tl" aria-hidden="true" />
            <i className="photo-corner photo-corner-tr" aria-hidden="true" />
            <i className="photo-corner photo-corner-bl" aria-hidden="true" />
            <i className="photo-corner photo-corner-br" aria-hidden="true" />
            <span>{draft.framing.style}</span>
          </div>
          <div className="range-grid">
            <label>
              水平焦点
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={draft.framing.crop.x}
                onChange={(event) => updateCrop("x", event.target.value)}
              />
            </label>
            <label>
              垂直焦点
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={draft.framing.crop.y}
                onChange={(event) => updateCrop("y", event.target.value)}
              />
            </label>
            <label>
              缩放
              <input
                type="range"
                min="1"
                max="2.2"
                step="0.02"
                value={draft.framing.crop.zoom}
                onChange={(event) => updateCrop("zoom", event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="editor-fields">
          <div className="eyebrow">EDIT MEMORY</div>
          <h2>整理这段回忆</h2>
          <div className="field-grid">
            <label>
              标题
              <input
                data-testid="memory-title"
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                required
              />
            </label>
            <label>
              拍摄日期
              <input
                data-testid="memory-date"
                type="text"
                inputMode="numeric"
                value={draft.capturedAt}
                onChange={(event) => update("capturedAt", event.target.value)}
                placeholder="YYYY-MM-DD"
                pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                maxLength="10"
                title="请输入 YYYY-MM-DD 格式的日期"
              />
            </label>
            <label>
              地点
              <input
                data-testid="memory-location"
                value={draft.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="待补充"
              />
            </label>
            <label>
              当时年龄
              <input value={age.label} readOnly />
            </label>
            <label>
              相框材质
              <select
                value={draft.framing.style}
                onChange={(event) => updateFraming("style", event.target.value)}
              >
                <option value="walnut">胡桃木</option>
                <option value="titanium">钛金属</option>
                <option value="oak">橡木</option>
              </select>
            </label>
            <label>
              相框方向
              <select
                value={draft.framing.orientation}
                onChange={(event) => updateFraming("orientation", event.target.value)}
              >
                <option value="landscape">横版</option>
                <option value="portrait">竖版</option>
                <option value="square">方形</option>
              </select>
            </label>
          </div>
          <label>
            手写寄语
            <textarea
              data-testid="memory-note"
              value={draft.note}
              onChange={(event) => update("note", event.target.value)}
              rows="4"
              placeholder="待补充"
            />
          </label>
          <label className="checkbox-row">
            <input
              data-testid="memory-hidden"
              type="checkbox"
              checked={draft.visibility === "hidden"}
              onChange={(event) => update("visibility", event.target.checked ? "hidden" : "visible")}
            />
            设为隐藏回忆，等待爪印彩蛋解锁
          </label>
          <div className="sheet-actions">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button data-testid="save-memory" type="submit" className="button primary">
              保存回忆
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TrashModal({ memories, onRestore, onPurge, onClose }) {
  return (
    <div className="modal-layer" data-testid="trash-modal">
      <section className="sheet trash-sheet">
        <button className="sheet-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <div className="eyebrow">RECYCLE BIN</div>
        <h2>回收站</h2>
        {memories.length === 0 ? (
          <p className="empty-state">这里暂时没有回忆。</p>
        ) : (
          <div className="trash-list">
            {memories.map((memory) => (
              <article className="trash-item" key={memory.id}>
                <div
                  className="thumb"
                  style={{ backgroundImage: `url("${memory.imageUrl}")` }}
                />
                <div>
                  <strong>{memory.title}</strong>
                  <small>{memory.deletedAt?.slice(0, 10)}</small>
                </div>
                <button className="button ghost" onClick={() => onRestore(memory.id)}>
                  恢复
                </button>
                <button className="button danger" onClick={() => onPurge(memory.id)}>
                  永久删除
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TimelineOverlay({ memories, profile, focusIndex, onFocus, onOpen }) {
  const groups = useMemo(() => groupMemoriesByMonth(memories), [memories]);
  const monthById = useMemo(
    () =>
      new Map(
        groups.flatMap((group) => group.memories.map((memory) => [memory.id, group.label])),
      ),
    [groups],
  );
  return (
    <div
      className="timeline-scroller"
      data-testid="timeline-scroller"
      onScroll={(event) => {
        const step = event.currentTarget.clientHeight * 0.72;
        onFocus(Math.round(event.currentTarget.scrollTop / step));
      }}
    >
      {memories.map((memory, index) => {
        const age = calculateAge(profile?.birthDate, memory.capturedAt, memory.ageOverrideMonths);
        return (
          <button
            key={memory.id}
            className={`timeline-stop ${index === focusIndex ? "active" : ""}`}
            onClick={() => onOpen(memory.id)}
          >
            <span>{monthById.get(memory.id)}</span>
            <strong>{memory.title}</strong>
            <small>{age.label}</small>
          </button>
        );
      })}
      <div className="timeline-tail" />
    </div>
  );
}

function PawEaster({ run, dropped }) {
  if (!run) return null;
  return (
    <div className="paw-layer" data-testid="paw-easter" key={run.id}>
      {Array.from({ length: 9 }, (_, index) => (
        <span
          className="walking-paw"
          key={index}
          style={{
            "--paw-index": index,
            "--paw-y": `${22 + (index % 2) * 9}vh`,
          }}
        >
          🐾
        </span>
      ))}
      {dropped && (
        <div
          className="hidden-drop"
          data-testid="hidden-drop"
          style={{ backgroundImage: `url("${dropped.imageUrl}")` }}
        >
          <span>发现隐藏回忆</span>
        </div>
      )}
    </div>
  );
}

export default function AlbumApp() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const repositoryRef = useRef(null);
  if (!repositoryRef.current) {
    const demoSession =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("session")
        : null;
    repositoryRef.current = createAlbumRepository({
      basePath,
      databaseName: demoSession ? `memories-3d-album-${demoSession}` : undefined,
    });
  }
  const repository = repositoryRef.current;
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("gallery");
  const [selectedId, setSelectedId] = useState(null);
  const [focusIndex, setFocusIndex] = useState(1);
  const [editId, setEditId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [toast, setToast] = useState("");
  const [lightMode, setLightMode] = useState("day");
  const [pawRun, setPawRun] = useState(null);
  const [droppedId, setDroppedId] = useState(null);
  const [hoverCue, setHoverCue] = useState(null);
  const [detailPanelReady, setDetailPanelReady] = useState(false);
  const fileInputRef = useRef(null);
  const blankClicksRef = useRef([]);

  const refresh = useCallback(async () => {
    setSnapshot(await repository.snapshot());
  }, [repository]);

  useEffect(() => {
    repository.initialize().then((next) => {
      setSnapshot(next);
      setReady(true);
      if (!next.profile) setProfileOpen(true);
    });
  }, [repository]);

  useEffect(() => {
    const update = () => {
      const params = new URLSearchParams(window.location.search);
      const override = params.get("demo") === "1" ? Number(params.get("hour")) : NaN;
      setLightMode(determineLightMode(Number.isFinite(override) ? override : new Date().getHours()));
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (view !== "detail" || !selectedId) {
      setDetailPanelReady(false);
      return;
    }
    const timer = setTimeout(() => setDetailPanelReady(true), 820);
    return () => clearTimeout(timer);
  }, [view, selectedId]);

  const allMemories = useMemo(
    () => [...snapshot.active, ...snapshot.hidden, ...snapshot.deleted],
    [snapshot],
  );
  const memoryViews = useMemoryUrls(allMemories);
  const memoryMap = useMemo(
    () => new Map(memoryViews.map((memory) => [memory.id, memory])),
    [memoryViews],
  );
  const active = useMemo(
    () => snapshot.active.map((memory) => memoryMap.get(memory.id)).filter(Boolean),
    [snapshot.active, memoryMap],
  );
  const hidden = useMemo(
    () => snapshot.hidden.map((memory) => memoryMap.get(memory.id)).filter(Boolean),
    [snapshot.hidden, memoryMap],
  );
  const deleted = useMemo(
    () => snapshot.deleted.map((memory) => memoryMap.get(memory.id)).filter(Boolean),
    [snapshot.deleted, memoryMap],
  );
  const sceneMemories = useMemo(() => {
    if (view === "timeline") {
      return [...active].sort((a, b) => {
        if (!a.capturedAt) return 1;
        if (!b.capturedAt) return -1;
        return a.capturedAt.localeCompare(b.capturedAt);
      });
    }
    return active;
  }, [active, view]);
  const selected = selectedId ? memoryMap.get(selectedId) : null;
  const editing = editId ? memoryMap.get(editId) : null;
  const dropped = droppedId ? memoryMap.get(droppedId) : null;

  useEffect(() => {
    if (!sceneMemories.length) return;
    setFocusIndex((current) => Math.min(current, Math.max(0, sceneMemories.length - 1)));
  }, [sceneMemories.length]);

  const showToast = (message) => setToast(message);

  const openMemory = (id) => {
    setHoverCue(null);
    setSelectedId(id);
    setView("detail");
  };

  const navigate = (nextView) => {
    setSelectedId(null);
    setView(nextView);
    if (nextView === "gallery") setFocusIndex(Math.min(1, Math.max(0, active.length - 1)));
    if (nextView === "timeline") setFocusIndex(0);
  };

  const saveProfile = async (profile) => {
    await repository.saveProfile(profile);
    await refresh();
    setProfileOpen(false);
    showToast("小狗档案已保存");
  };

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploadProgress({ completed: 0, total: files.length, file: "" });
    const { results, errors } = await processPhotoFiles(files, setUploadProgress);
    if (results.length) {
      const records = await repository.addProcessedPhotos(results);
      await refresh();
      setEditId(records[0].id);
      showToast(`${records.length} 张照片已自动装框`);
    }
    if (errors.length) showToast(`${errors.length} 张照片无法读取`);
    setUploadProgress(null);
  };

  const saveMemory = async (draft) => {
    await repository.updateMemory(editId, draft);
    const becameHidden = draft.visibility === "hidden";
    await refresh();
    setEditId(null);
    if (becameHidden && selectedId === editId) navigate("gallery");
    showToast(becameHidden ? "已藏进爪印彩蛋" : "回忆已保存");
  };

  const handleBlankClick = async (point) => {
    const now = performance.now();
    blankClicksRef.current = [...blankClicksRef.current.filter((time) => now - time < 2000), now];
    if (blankClicksRef.current.length < 5) return;
    blankClicksRef.current = [];
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("demo") === "1" && params.get("easter") === "always";
    const drop =
      hidden.length > 0 &&
      shouldDropHidden(snapshot.settings.easterMisses, forced ? 0 : Math.random());
    const run = { id: now, point };
    setPawRun(run);
    if (drop) {
      const memory = hidden[Math.floor(Math.random() * hidden.length)];
      setTimeout(() => setDroppedId(memory.id), 520);
      setTimeout(async () => {
        await repository.discoverHidden(memory.id);
        await refresh();
        showToast(`发现隐藏回忆：${memory.title}`);
      }, 1750);
    } else {
      await repository.setEasterMisses((snapshot.settings.easterMisses ?? 0) + 1);
      await refresh();
    }
    setTimeout(() => {
      setPawRun(null);
      setDroppedId(null);
    }, 3400);
  };

  const handleExport = async () => {
    if (!selected) return;
    try {
      const result = await shareMemorialCard(selected, snapshot.profile, selected.fullImageUrl);
      showToast(result.shared ? "纪念卡已分享" : "纪念卡已下载");
    } catch (error) {
      if (error.name !== "AbortError") showToast(error.message);
    }
  };

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="loading-paw">🐾</div>
        <p>正在打开回忆展厅…</p>
      </main>
    );
  }

  return (
    <main className={`album-app light-${lightMode} mode-${view}`}>
      <div className="ambient-title" aria-hidden="true">
        MEMORIES
      </div>
      <ThreeGallery
        memories={sceneMemories}
        profile={snapshot.profile}
        mode={view}
        selectedId={selectedId}
        focusIndex={focusIndex}
        lightMode={lightMode}
        onSelect={openMemory}
        onBlankClick={handleBlankClick}
        onTableLayoutChange={async (id, table) => {
          await repository.updateTable(id, table);
        }}
        onFocusChange={setFocusIndex}
        onHoverChange={(id, point) =>
          setHoverCue(id && point ? { id, x: point.x, y: point.y } : null)
        }
      />

      <header className="topbar">
        <button className="brand" onClick={() => navigate("gallery")}>
          <Icon>🐾</Icon>
          <span>{snapshot.profile?.name || "MEMORIES"}</span>
        </button>
        <nav className="view-tabs" aria-label="相册视图">
          <button
            className={view === "gallery" ? "active" : ""}
            onClick={() => navigate("gallery")}
          >
            展厅
          </button>
          <button
            data-testid="timeline-tab"
            className={view === "timeline" ? "active" : ""}
            onClick={() => navigate("timeline")}
          >
            成长时间轴
          </button>
          <button
            data-testid="collection-tab"
            className={view === "table" ? "active" : ""}
            onClick={() => navigate("table")}
          >
            我的收藏
          </button>
        </nav>
        <div className="top-actions">
          <span className="light-chip">
            {lightMode === "day" ? "☀ 窗边日光" : "☾ 暖色夜灯"}
          </span>
          <button className="circle-button" onClick={() => setProfileOpen(true)} title="小狗档案">
            ✎
          </button>
          <button
            data-testid="trash-button"
            className="circle-button"
            onClick={() => setTrashOpen(true)}
            title="回收站"
          >
            ♻
          </button>
          <button
            data-testid="upload-button"
            className="button upload"
            onClick={() => fileInputRef.current?.click()}
          >
            ＋ 上传照片
          </button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={(event) => {
              uploadFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {view === "gallery" && sceneMemories.length > 0 && (
        <div className="gallery-controls">
          <button
            onClick={() => setFocusIndex((index) => Math.max(0, index - 1))}
            disabled={focusIndex === 0}
          >
            ←
          </button>
          <button className="focus-label" onClick={() => openMemory(sceneMemories[focusIndex].id)}>
            <span>{sceneMemories[focusIndex].isSample ? "示例回忆" : "回忆"}</span>
            <strong>{sceneMemories[focusIndex].title}</strong>
            <small>
              {focusIndex + 1} / {sceneMemories.length}
            </small>
          </button>
          <button
            onClick={() =>
              setFocusIndex((index) => Math.min(sceneMemories.length - 1, index + 1))
            }
            disabled={focusIndex === sceneMemories.length - 1}
          >
            →
          </button>
        </div>
      )}

      {view === "gallery" && hoverCue && (
        <div
          className="open-slip"
          style={{ left: hoverCue.x + 18, top: hoverCue.y + 18 }}
        >
          翻阅这段回忆
        </div>
      )}

      {view === "table" && (
        <div className="mode-hint">
          <strong>收藏桌面</strong>
          <span>拖拽、排列或甩动相框；相框会碰撞回弹，布局自动保存</span>
        </div>
      )}

      {view === "timeline" && (
        <TimelineOverlay
          memories={sceneMemories}
          profile={snapshot.profile}
          focusIndex={focusIndex}
          onFocus={setFocusIndex}
          onOpen={openMemory}
        />
      )}

      {view === "detail" && selected && detailPanelReady && (
        <>
          <button
            data-testid="detail-close"
            className="detail-close"
            onClick={() => navigate("gallery")}
            aria-label="关闭"
          >
            ×
          </button>
          <section className="detail-panel" data-testid="detail-panel">
            <div className="eyebrow">
              {selected.isSample ? "SAMPLE MEMORY" : "MEMORY"}
            </div>
            <h1>{selected.title}</h1>
            <p className="detail-note">{selected.note || "寄语待补充"}</p>
            <dl>
              <div>
                <dt>拍摄日期</dt>
                <dd>{selected.capturedAt || "待补充"}</dd>
              </div>
              <div>
                <dt>地点</dt>
                <dd>{selected.location || "待补充"}</dd>
              </div>
              <div>
                <dt>{snapshot.profile?.name || "小狗"}当时</dt>
                <dd>
                  {
                    calculateAge(
                      snapshot.profile?.birthDate,
                      selected.capturedAt,
                      selected.ageOverrideMonths,
                    ).label
                  }
                </dd>
              </div>
            </dl>
            <div className="detail-hint">拖动相框旋转，翻到背面查看手写信息</div>
            <div className="detail-actions">
              <button
                data-testid="edit-memory"
                className="button light"
                onClick={() => setEditId(selected.id)}
              >
                编辑回忆
              </button>
              <button
                data-testid="export-card"
                className="button primary"
                onClick={handleExport}
              >
                生成纪念卡
              </button>
              <button
                data-testid="delete-memory"
                className="button danger"
                onClick={async () => {
                  await repository.softDelete(selected.id);
                  await refresh();
                  navigate("gallery");
                  showToast("已移入回收站");
                }}
              >
                删除
              </button>
            </div>
          </section>
        </>
      )}

      {profileOpen && (
        <ProfileModal
          profile={snapshot.profile}
          onSave={saveProfile}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {editing && (
        <MemoryEditor
          memory={editing}
          profile={snapshot.profile}
          onSave={saveMemory}
          onClose={() => setEditId(null)}
        />
      )}
      {trashOpen && (
        <TrashModal
          memories={deleted}
          onClose={() => setTrashOpen(false)}
          onRestore={async (id) => {
            await repository.restore(id);
            await refresh();
            showToast("回忆已恢复");
          }}
          onPurge={async (id) => {
            await repository.purge(id);
            await refresh();
            showToast("本地照片数据已永久清理");
          }}
        />
      )}
      {uploadProgress && (
        <div className="upload-progress" data-testid="upload-progress">
          <span>正在装框 {uploadProgress.completed}/{uploadProgress.total}</span>
          <strong>{uploadProgress.file}</strong>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
      <PawEaster run={pawRun} dropped={dropped} />
    </main>
  );
}
