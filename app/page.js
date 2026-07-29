export default function HomePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <main className="experience-shell">
      <iframe
        className="experience-frame"
        src={`${basePath}/experience.html`}
        title="Memories 3D 相册"
        allow="autoplay"
      />
    </main>
  );
}
