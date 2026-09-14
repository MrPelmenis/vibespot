"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "@/components/map/MapView";

// Leaflet touches `window` at import time, so the actual map loads client-only.
const LeafletMapView = dynamic<MapViewProps>(
  () => import("@/components/map/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
  },
);

export function MapViewClient(props: MapViewProps) {
  return <LeafletMapView {...props} />;
}
