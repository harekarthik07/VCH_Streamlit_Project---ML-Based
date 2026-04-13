import "./globals.css";

export const metadata = {
  title: "Raptee Thermal Suite",
  description: "Thermal & Dynamics Analytics Engine V4",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}