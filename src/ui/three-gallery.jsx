"use client";

import { useEffect, useRef } from "react";
import { createGalleryEngine } from "../three/gallery-engine";

export function ThreeGallery({
  memories,
  profile,
  mode,
  selectedId,
  focusIndex,
  lightMode,
  onSelect,
  onBlankClick,
  onTableLayoutChange,
  onFocusChange,
  onHoverChange,
}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const callbacksRef = useRef({});
  callbacksRef.current = {
    onSelect,
    onBlankClick,
    onTableLayoutChange,
    onFocusChange,
    onHoverChange,
  };

  useEffect(() => {
    const engine = createGalleryEngine(canvasRef.current, {
      onSelect: (...args) => callbacksRef.current.onSelect?.(...args),
      onBlankClick: (...args) => callbacksRef.current.onBlankClick?.(...args),
      onTableLayoutChange: (...args) =>
        callbacksRef.current.onTableLayoutChange?.(...args),
      onFocusChange: (...args) => callbacksRef.current.onFocusChange?.(...args),
      onHoverChange: (...args) => callbacksRef.current.onHoverChange?.(...args),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMemories(memories, profile);
    engineRef.current?.setFocus(focusIndex);
  }, [memories, profile]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (mode === "detail") {
      engineRef.current.setSelected(selectedId);
      engineRef.current.setMode(mode);
    } else {
      engineRef.current.setMode(mode);
    }
  }, [mode, selectedId]);
  useEffect(() => engineRef.current?.setFocus(focusIndex), [focusIndex]);
  useEffect(() => engineRef.current?.setLightMode(lightMode), [lightMode]);

  return (
    <canvas
      ref={canvasRef}
      className="gallery-canvas"
      data-testid="gallery-canvas"
      aria-label="3D 回忆展厅"
    />
  );
}
