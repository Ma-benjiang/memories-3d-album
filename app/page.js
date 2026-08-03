import StoryHome from "../src/story/story-home";

export default function HomePage() {
  return (
    <>
      <link
        rel="preload"
        href="/models/denis-circular-gallery.glb"
        as="fetch"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/story-woman-cat.webp"
        as="image"
        fetchPriority="high"
      />
      <StoryHome />
    </>
  );
}
