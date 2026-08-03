"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STORY_CHAPTERS } from "./story-data";

const StoryScene = dynamic(
  () => import("./story-scene").then((module) => module.StoryScene),
  { ssr: false },
);

function useExperiencePreferences() {
  const [preferences, setPreferences] = useState({
    mobile: false,
    reducedMotion: false,
  });

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setPreferences({
        mobile: mobileQuery.matches,
        reducedMotion: motionQuery.matches,
      });
    update();
    mobileQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  return preferences;
}

export default function StoryHome() {
  const containerRef = useRef(null);
  const chapterRefs = useRef([]);
  const progressRef = useRef(null);
  const [sceneReady, setSceneReady] = useState(false);
  const story = useRef({
    cameraProgress: 0,
    lookProgress: 0,
    fov: 64,
    lightIntensity: 0,
  });
  const { mobile, reducedMotion } = useExperiencePreferences();
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  useLayoutEffect(() => {
    if (reducedMotion || !containerRef.current) {
      Object.assign(story.current, {
        cameraProgress: 0.08,
        lookProgress: 0.08,
        fov: 60,
        lightIntensity: 0.7,
      });
      return undefined;
    }

    gsap.registerPlugin(ScrollTrigger);
    const cards = chapterRefs.current.filter(Boolean);
    const context = gsap.context(() => {
      gsap.set(cards, { autoAlpha: 0, y: 42 });
      gsap.set(cards[0], { autoAlpha: 1, y: 0 });
      gsap.set(progressRef.current, { scaleY: 0, transformOrigin: "top center" });

      const master = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: mobile ? 0.32 : 0.55,
          invalidateOnRefresh: true,
        },
      });

      const totalDuration = STORY_CHAPTERS.length * 2;
      const lastPathIndex = STORY_CHAPTERS.length;
      for (let index = 1; index <= lastPathIndex; index += 1) {
        master.to(
          story.current,
          {
            cameraProgress: index / lastPathIndex,
            lookProgress: index / lastPathIndex,
            duration: 1.35,
            ease: "power1.inOut",
          },
          (index - 1) * 2 + 0.65,
        );
      }

      master
        .to(story.current, { fov: 52, duration: 0.85, ease: "sine.inOut" }, 1.05)
        .to(story.current, { fov: 54, duration: 1.1, ease: "sine.inOut" }, 12.65)
        .to(story.current, { lightIntensity: 1, duration: 11.5 }, 0.5)
        .to(progressRef.current, { scaleY: 1, duration: totalDuration }, 0);

      const cues = cards.map((_, index) => index * 2);
      cards.forEach((card, index) => {
        if (index > 0) {
          master.fromTo(
            card,
            { autoAlpha: 0, y: 42 },
            { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
            cues[index] - 0.15,
          );
        }
        const outAt =
          index === cards.length - 1 ? totalDuration - 0.75 : cues[index + 1] - 0.6;
        master.to(
          card,
          { autoAlpha: 0, y: -34, duration: 0.35, ease: "power2.in" },
          outAt,
        );
      });
    }, containerRef);

    const lenis = new Lenis({
      duration: mobile ? 0.85 : 1.08,
      smoothWheel: true,
      touchMultiplier: 1.1,
    });
    let frameId = 0;
    const frame = (time) => {
      lenis.raf(time);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    lenis.on("scroll", ScrollTrigger.update);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
      context.revert();
    };
  }, [mobile, reducedMotion]);

  return (
    <main
      ref={containerRef}
      className={`story-home ${reducedMotion ? "is-reduced" : ""}`}
    >
      <div
        className={`story-canvas ${sceneReady ? "is-ready" : ""}`}
        aria-hidden="true"
      >
        <StoryScene
          story={story}
          mobile={mobile}
          reducedMotion={reducedMotion}
          onReady={handleSceneReady}
        />
        <div className="story-loader">
          <i />
          <span>正在布展</span>
        </div>
      </div>

      <header className="story-header">
        <Link className="story-brand" href="/" aria-label="Memories 首页">
          <span>MEMORIES</span>
          <small>PRIVATE 3D ARCHIVE</small>
        </Link>
        <Link className="story-enter" href="/album">
          进入相册 <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="story-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>

      <div className="story-chapters">
        {STORY_CHAPTERS.map((chapter, index) => (
          <section
            className={`story-card story-card-${index + 1}`}
            ref={(node) => {
              chapterRefs.current[index] = node;
            }}
            key={chapter.index}
          >
            <div className="story-card-index">
              {chapter.index === "00" ? "ROOM / 00" : `${chapter.index} / 06`}
            </div>
            <p>{chapter.eyebrow}</p>
            <h1>{chapter.title}</h1>
            <div className="story-card-body">{chapter.body}</div>
            {index === 0 && (
              <div className="story-scroll-cue">
                <i />
                <span>向下滚动，进入回忆</span>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="story-finale">
        <p>YOUR MEMORIES, YOUR SPACE</p>
        <h2>打开属于你的回忆展厅。</h2>
        <Link href="/album">
          进入 3D 相册 <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
