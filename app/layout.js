import "./globals.css";

export const metadata = {
  title: "Memories · 3D 相册",
  description: "沉浸式拟物 3D 相册收藏体验",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
