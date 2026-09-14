/**
 * Leaflet tile source. MapTiler raster tiles when NEXT_PUBLIC_MAPTILER_KEY is set,
 * else OpenStreetMap raster — both plain <img> tiles, no WebGL required.
 */
export type TileStyle = "streets" | "satellite";

export function tileUrl(style: TileStyle = "streets"): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const mapId =
    style === "satellite"
      ? "satellite"
      : (process.env.NEXT_PUBLIC_MAPTILER_MAP ?? "streets-v2");
  if (key) {
    return `https://api.maptiler.com/maps/${mapId}/{z}/{x}/{y}.png?key=${key}`;
  }
  return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export function tileAttribution(): string {
  if (process.env.NEXT_PUBLIC_MAPTILER_KEY) {
    return '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
}
