import "./globals.css";

export const metadata = {
  title: "Coach Me",
  description: "Personal fitness tracking + AI training recommendations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#16181A]">{children}</body>
    </html>
  );
}
