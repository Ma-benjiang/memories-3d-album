# Keep the Three.js engine imperative

The existing Three.js rendering and motion system will be extracted into modules rather than rewritten with React Three Fiber. React will own application UI and orchestration, while the 3D engine exposes a narrow command and event interface; this preserves the established visual behavior and reduces migration risk.
