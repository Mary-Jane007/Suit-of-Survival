"use client";

import { use } from "react";
import { RoomClient } from "@/components/room-client";

export default function ScreenRoom({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <RoomClient code={code} mode="screen" />;
}
