"use client";

import {
  ContactShadows,
  Environment,
  Lightformer,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getStoryPath, STORY_EXHIBITS } from "./story-data";

const GALLERY_PHOTO_URLS = STORY_EXHIBITS.map((exhibit) => exhibit.url);

const INNER_WALL_SLOTS = [
  [-4.677, 0.463],
  [0.462, 4.677],
  [4.677, -0.462],
  [-0.463, -4.676],
];

const INNER_OUTER_FACE_SLOTS = [
  [-5.104, 0.461],
  [0.46, 5.104],
  [5.104, -0.46],
  [-0.46, -5.103],
];

const OUTER_WALL_SLOTS = [
  [-8.103, 0.802],
  [-6.617, 4.746],
  [-3.359, 7.419],
  [0.8, 8.104],
  [4.744, 6.618],
  [7.417, 3.36],
  [8.102, -0.799],
  [6.617, -4.743],
  [3.358, -7.416],
  [-0.8, -8.101],
  [-4.745, -6.616],
  [-7.417, -3.357],
];

function createArtworkSlot([x, z], facesOutward = false) {
  const direction = facesOutward ? 1 : -1;
  const length = Math.hypot(x, z);
  const normalX = (x / length) * direction;
  const normalZ = (z / length) * direction;

  return {
    position: [x + normalX * 0.045, 0.13, z + normalZ * 0.045],
    rotation: [0, Math.atan2(normalX, normalZ), 0],
  };
}

const GALLERY_ARTWORK_SLOTS = [
  ...INNER_WALL_SLOTS.map((slot) => createArtworkSlot(slot)),
  ...INNER_OUTER_FACE_SLOTS.map((slot) => createArtworkSlot(slot, true)),
  ...OUTER_WALL_SLOTS.map((slot) => createArtworkSlot(slot)),
];

function makeCurve(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "catmullrom",
    0.34,
  );
}

function createDustPositions(count) {
  const positions = new Float32Array(count * 3);
  let seed = 27;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * 10.2;
    positions[index * 3 + 1] = -1.2 + random() * 5;
    positions[index * 3 + 2] = 7 - random() * 35;
  }

  return positions;
}

function CameraRig({ story, mobile, reducedMotion }) {
  const { camera } = useThree();
  const path = useMemo(() => getStoryPath(mobile), [mobile]);
  const positionCurve = useMemo(
    () => makeCurve(path.camera),
    [path],
  );
  const lookCurve = useMemo(
    () => makeCurve(path.look),
    [path],
  );
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((renderState) => {
    const state = story.current;
    positionCurve.getPoint(THREE.MathUtils.clamp(state.cameraProgress, 0, 1), camera.position);
    lookCurve.getPoint(THREE.MathUtils.clamp(state.lookProgress, 0, 1), target);
    if (!reducedMotion) {
      const breath = mobile ? 0.006 : 0.014;
      camera.position.x += Math.cos(renderState.clock.elapsedTime * 0.3) * breath * 0.35;
      camera.position.y += Math.sin(renderState.clock.elapsedTime * 0.42) * breath;
      target.y += Math.sin(renderState.clock.elapsedTime * 0.34) * breath * 0.45;
    }
    camera.lookAt(target);
    if (Math.abs(camera.fov - state.fov) > 0.01) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function MemoryFrame({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  tone = "#5f3827",
  reducedMotion = false,
}) {
  const texture = useLoader(THREE.TextureLoader, url);
  const pictureLight = useRef(null);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((renderState) => {
    if (!pictureLight.current) return;
    pictureLight.current.intensity = reducedMotion
      ? 3.2
      : 3.15 + Math.sin(renderState.clock.elapsedTime * 0.62 + position[2] * 0.31) * 0.42;
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <pointLight
        ref={pictureLight}
        position={[0, 1.65, 1.15]}
        intensity={2.6}
        distance={3.8}
        color="#ffe3bd"
      />
      <mesh receiveShadow>
        <boxGeometry args={[3.12, 2.4, 0.16]} />
        <meshStandardMaterial color={tone} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.087]}>
        <planeGeometry args={[2.88, 2.16]} />
        <meshBasicMaterial color="#d8cebb" />
      </mesh>
      <mesh position={[0, 0, 0.094]}>
        <planeGeometry args={[2.68, 2.01]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.094]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.68, 2.01]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.104]}>
        <planeGeometry args={[2.68, 2.01]} />
        <meshPhysicalMaterial
          color="#dff3ff"
          transparent
          opacity={0.055}
          roughness={0.05}
          clearcoat={1}
          depthWrite={false}
        />
      </mesh>
      <group position={[0, -1.42, 0.1]}>
        <mesh>
          <planeGeometry args={[0.82, 0.28]} />
          <meshBasicMaterial color="#d8cebb" />
        </mesh>
        <mesh position={[0, 0.035, 0.006]}>
          <planeGeometry args={[0.56, 0.018]} />
          <meshBasicMaterial color="#76695b" />
        </mesh>
        <mesh position={[-0.12, -0.045, 0.006]}>
          <planeGeometry args={[0.32, 0.012]} />
          <meshBasicMaterial color="#9b8b79" />
        </mesh>
      </group>
    </group>
  );
}

function DustMotes({ mobile, reducedMotion }) {
  const root = useRef(null);
  const material = useRef(null);
  const positions = useMemo(
    () => createDustPositions(mobile ? 72 : 180),
    [mobile],
  );

  useFrame((renderState) => {
    if (reducedMotion || !root.current || !material.current) return;
    const elapsed = renderState.clock.elapsedTime;
    root.current.position.y = Math.sin(elapsed * 0.18) * 0.045;
    root.current.rotation.y = Math.sin(elapsed * 0.07) * 0.008;
    material.current.opacity = 0.12 + Math.sin(elapsed * 0.38) * 0.025;
  });

  return (
    <points ref={root}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#efc49d"
        size={mobile ? 0.035 : 0.028}
        sizeAttenuation
        transparent
        opacity={0.12}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function GalleryFurniture() {
  const cushionGeometry = useMemo(
    () => new RoundedBoxGeometry(3.2, 0.42, 1.08, 5, 0.18),
    [],
  );
  const baseGeometry = useMemo(
    () => new RoundedBoxGeometry(2.88, 0.16, 0.82, 4, 0.07),
    [],
  );

  return (
    <group position={[0.75, -1.66, 7.1]} rotation={[0, -0.08, 0]}>
      <pointLight position={[0, 1.1, 0.35]} intensity={0.75} distance={3.5} color="#ffd8a9" />

      <mesh position={[0, 0.63, 0]} castShadow receiveShadow>
        <primitive object={cushionGeometry} attach="geometry" />
        <meshStandardMaterial color="#b68a70" roughness={0.94} metalness={0} />
      </mesh>
      {[-0.82, 0, 0.82].map((x) => (
        <mesh key={x} position={[x, 0.825, 0]}>
          <boxGeometry args={[0.012, 0.01, 0.86]} />
          <meshBasicMaterial color="#735448" transparent opacity={0.42} />
        </mesh>
      ))}

      <mesh position={[0, 0.36, 0]} castShadow>
        <primitive object={baseGeometry} attach="geometry" />
        <meshStandardMaterial color="#5c3726" roughness={0.52} metalness={0.05} />
      </mesh>
      {[
        [-1.15, 0.12, -0.31],
        [-1.15, 0.12, 0.31],
        [1.15, 0.12, -0.31],
        [1.15, 0.12, 0.31],
      ].map(([x, y, z]) => (
        <group key={`${x}-${z}`} position={[x, y, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.038, 0.048, 0.5, 14]} />
            <meshStandardMaterial color="#876b4c" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.255, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.025, 16]} />
            <meshStandardMaterial color="#4b4139" roughness={0.48} metalness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.08, -0.31]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 2.3, 12]} />
        <meshStandardMaterial color="#876b4c" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.08, 0.31]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 2.3, 12]} />
        <meshStandardMaterial color="#876b4c" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

function GalleryShell() {
  const { scene } = useGLTF("/models/denis-circular-gallery.glb");
  const gallery = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    gallery.traverse((child) => {
      if (!child.isMesh) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const materialNames = materials.map((material) => material?.name ?? "");

      if (materialNames.includes("Painting")) {
        child.visible = false;
        return;
      }

      child.castShadow = materialNames.some((name) =>
        /Bench|Lamp/i.test(name),
      );
      child.receiveShadow = true;

      materials.forEach((material) => {
        if (!material) return;
        material.envMapIntensity = 0.58;
        if (material.name === "Floor") {
          material.color.set("#d8d0c4");
          material.emissive.set("#51473f");
          material.emissiveIntensity = 0.18;
          material.metalness = 0;
          material.roughness = 0.82;
        }
        if (material.name === "Emissive") {
          material.emissiveIntensity = 1.45;
        }
        material.needsUpdate = true;
      });
    });
  }, [gallery]);

  return (
    <primitive
      object={gallery}
      position={[0, -1.62, 0]}
    />
  );
}

function GalleryArtworkSlots() {
  const textures = useLoader(THREE.TextureLoader, GALLERY_PHOTO_URLS);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    });
  }, [textures]);

  return (
    <group>
      {GALLERY_ARTWORK_SLOTS.map((slot, index) => (
        <mesh
          key={`${slot.position[0]}-${slot.position[2]}`}
          position={slot.position}
          rotation={slot.rotation}
        >
          <planeGeometry args={[1.82, 1.23]} />
          <meshBasicMaterial
            map={textures[index % textures.length]}
            toneMapped={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}

function GalleryPlant() {
  const leaves = [
    [-0.28, 1.3, 0.04, -0.5],
    [0.22, 1.45, 0.08, 0.46],
    [-0.08, 1.72, -0.02, -0.15],
    [0.38, 1.1, -0.05, 0.72],
    [-0.42, 1.02, 0.06, -0.76],
    [0.08, 1.18, 0.18, 0.15],
  ];

  return (
    <group position={[-4.35, -1.73, 7.4]} rotation={[0, 0.35, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.44, 0.34, 0.76, 32]} />
        <meshStandardMaterial color="#b8a28a" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.77, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 32]} />
        <meshStandardMaterial color="#51453b" roughness={1} />
      </mesh>
      {leaves.map(([x, y, z, rotation], index) => (
        <group key={index} position={[x, y, z]} rotation={[0, 0, rotation]}>
          <mesh position={[0, -0.35, 0]}>
            <cylinderGeometry args={[0.015, 0.025, 0.8, 8]} />
            <meshStandardMaterial color="#52624a" roughness={0.9} />
          </mesh>
          <mesh
            position={[0, 0.03, 0]}
            rotation={[0.35, index % 2 ? 0.45 : -0.35, 0]}
            scale={[0.5, 1.5, 0.18]}
            castShadow
          >
            <sphereGeometry args={[0.28, 18, 12]} />
            <meshStandardMaterial color={index % 2 ? "#617457" : "#4c674e"} roughness={0.82} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GalleryArchitecture({ story, mobile, reducedMotion }) {
  const warmLight = useRef(null);
  const daylight = useRef(null);

  useFrame((renderState) => {
    if (warmLight.current) {
      const breathe = reducedMotion ? 0 : Math.sin(renderState.clock.elapsedTime * 0.34) * 0.35;
      warmLight.current.intensity = 3.8 + story.current.lightIntensity * 2.4 + breathe;
    }
    if (!reducedMotion && daylight.current) {
      daylight.current.intensity =
        3.8 + Math.sin(renderState.clock.elapsedTime * 0.18) * 0.22;
    }
  });

  return (
    <>
      <color attach="background" args={["#d6d0c4"]} />
      <fog attach="fog" args={["#d6d0c4", 18, 34]} />
      <hemisphereLight args={["#f7f1e5", "#55483c", 1.15]} />
      <directionalLight
        ref={daylight}
        position={[-3, 8, 5]}
        intensity={3.15}
        color="#fff4dc"
        castShadow={!mobile}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0003}
      />
      <pointLight ref={warmLight} position={[0, 2.8, -4]} color="#ffd6a4" distance={16} />
      <pointLight
        position={[0, 3.2, 5.5]}
        intensity={4.2}
        color="#e7f1f0"
        distance={15}
      />

      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#fff0d8"
          position={[0, 7, 1]}
          rotation-x={Math.PI / 2}
          scale={[11, 11, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#d8ebee"
          position={[8, 2, 0]}
          rotation-y={-Math.PI / 2}
          scale={[8, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#e8c5a2"
          position={[-8, 1, -2]}
          rotation-y={Math.PI / 2}
          scale={[8, 10, 1]}
        />
      </Environment>
      <GalleryShell />
      <GalleryArtworkSlots />
      {!mobile && (
        <ContactShadows
          position={[0, -1.6, 0]}
          opacity={0.22}
          scale={16}
          blur={2.8}
          far={5}
          resolution={512}
          frames={reducedMotion ? 1 : Infinity}
          color="#493729"
        />
      )}
      <DustMotes mobile={mobile} reducedMotion={reducedMotion} />
    </>
  );
}

function StoryModels({ reducedMotion }) {
  return (
    <>
      {STORY_EXHIBITS.map((exhibit) => (
        <MemoryFrame
          key={exhibit.url}
          url={exhibit.url}
          {...exhibit.frame}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

useGLTF.preload("/models/denis-circular-gallery.glb");

export function StoryScene({ story, mobile, reducedMotion }) {
  return (
    <Canvas
      dpr={mobile ? 1 : [1, 1.5]}
      camera={{ fov: 64, near: 0.1, far: 40, position: [0, 3.2, 0.8] }}
      gl={{ antialias: !mobile, alpha: false, powerPreference: "high-performance" }}
      shadows={!mobile}
      frameloop={reducedMotion ? "demand" : "always"}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = mobile ? 0.96 : 1.02;
      }}
    >
      <GalleryArchitecture story={story} mobile={mobile} reducedMotion={reducedMotion} />
      <StoryModels reducedMotion={reducedMotion} />
      <CameraRig story={story} mobile={mobile} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
