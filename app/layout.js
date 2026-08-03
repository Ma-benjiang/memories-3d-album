import "./globals.css";

export const metadata = {
  title: "Memories · 会呼吸的 3D 回忆展厅",
  description: "沿着一镜到底的 3D 空间，重新遇见那些值得收藏的时刻。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
