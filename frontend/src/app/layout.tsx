import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UniBus",
  description: "University Bus Tracking and Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<html lang="en">
  <body
    className={`min-w-screen min-h-screen flex flex-1 flex-col justify-center items-center ${geistSans.variable} ${geistMono.variable} antialiased`}
  >
    {children}
    <Toaster richColors />
  </body>
</html>
  );
}


// import { useEffect } from "react";
// import { getSocket } from "@/lib/socket";
// import BusTrackingModal from "@/components/BusTrackingModal";
// import { Toaster } from "@/components/ui/sonner";

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   useEffect(() => {
//     let socket: any;

//     (async () => {
//       socket = await getSocket();

//       socket.on("bus_tracking_request", (payload: any) => {
//         window.dispatchEvent(
//           new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
//         );
//       });
//     })();

//     return () => {
//       if (socket) {
//         socket.off("bus_tracking_request");
//       }
//     };
//   }, []);

//   return (
//     <html lang="en">
//       <body
//         className={`min-w-screen min-h-screen flex flex-1 flex-col justify-center items-center ${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         {children}
//         <BusTrackingModal />
//         <Toaster richColors />
//       </body>
//     </html>
//   );
// }
