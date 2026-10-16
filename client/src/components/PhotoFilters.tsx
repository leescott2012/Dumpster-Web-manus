/**
 * PhotoFilters — Photo pool filtering controls
 * Filter by: category, favorite, date range, camera, aspect ratio
 */
import { useState, useCallback, useMemo } from "react";
import { X, Filter, Heart, Star, Calendar, Camera, LayoutDashboard, RefreshCw, Grid3x3 } from "lucide-react";
import type { Photo } from "@/lib/photoData";

export type PhotoFilter = {
  category: string | "all";
  favorite: boolean | "all";
  dateFrom: Date | null;
  dateTo: Date | null;
  camera: string | "all";
  aspectRatio: "all" | "portrait" | "square" | "landscape";
  searchQuery: string;
};

export const DEFAULT_FILTERS: PhotoFilter = {
  category: "all",
  favorite: "all",
  dateFrom: null,
  dateTo: null,
  camera: "all",
  aspectRatio: "all",
  searchQuery: "",
};

// ── Categories from photoData.ts ─────────────────────────────────────────────

export const PHOTO_CATEGORIES = [
  "ALL",
  "Portrait", "Automotive", "Studio", "Nightlife", "Travel",
  "Architecture", "Art", "Fashion", "Lifestyle", "Culture",
  "Fitness", "Dining", "Food", "Abstract", "Nature",
];

// ── Helper Functions ───────────────────────────────────────────────────────────

export function getPhotoAspectRato(photo: Photo): "portrait" | "square" | "landscape" {
  const w = photo.meta?.width || 400;
  const h = photo.meta?.height || 500;
  const ratio = w / h;

  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

export function getUniqueCameras(photos: Photo[]): string[] {
  const cameras = new Set<string>();
  photos.forEach(photo => {
    if (photo.meta?.camera) {
      cameras.add(photo.meta.camera.split(" - ")[0] || photo.meta.camera);
    }
  });
  return Array.from(cameras).sort();
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ── Filter Chip Component ─────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

function FilterChip({ label, active, onClick, count }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent)" : "#1a1a1a",
        color: active ? "#000" : "#888",
        border: "1px solid #2a2a2a",
        borderRadius: 100,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)",
          borderRadius: 100,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main Filter Component ───────────────────────────────────────────────────

interface PhotoFiltersProps {
  photos: Photo[];
  filters: PhotoFilter;
  onChange: (filters: PhotoFilter) => void;
  onClear: () => void;
}

export default function PhotoFilters({
  photos,
  filters,
  onChange,
  onClear,
}: PhotoFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateInputOpen, setDateInputOpen] = useState<"from" | "to" | null>(null);

  // Update a single filter field
  const updateFilter = useCallback((field: keyof PhotoFilter, value: any) => {
    onChange({ ...filters, [field]: value });
  }, [filters, onChange]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Category filter
      if (filters.category !== "all" && photo.category !== filters.category) return false;

      // Favorite filter
      if (filters.favorite !== "all" && photo.isFavorite !== (filters.favorite === true)) return false;

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const photoDate = photo.meta?.takenAt;
        if (photoDate) {
          const photoTime = new Date(photoDate).getTime();
          if (filters.dateFrom && photoTime < filters.dateFrom.getTime()) return false;
          if (filters.dateTo && photoTime > filters.dateTo.getTime()) return false;
        }
      }

      // Camera filter
      if (filters.camera !== "all" && photo.meta?.camera) {
        const cameraBrand = photo.meta.camera.split(" - ")[0];
        if (cameraBrand !== filters.camera) return false;
      }

      // Aspect ratio filter
      if (filters.aspectRatio !== "all") {
        const aspect = getPhotoAspectRato(photo);
        if (filters.aspectRatio !== aspect) return false;
      }

      // Search query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesAlt = photo.alt?.toLowerCase().includes(q);
        const matchesCategory = photo.category?.toLowerCase().includes(q);
        if (!matchesAlt && !matchesCategory) return false;
      }

      return true;
    });
  }, [photos, filters]);

  // Count for various filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== "all") count++;
    if (filters.favorite !== "all") count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.camera !== "all") count++;
    if (filters.aspectRatio !== "all") count++;
    if (filters.searchQuery.trim()) count++;
    return count;
  }, [filters]);

  const uniqueCameras = useMemo(() => getUniqueCameras(filteredPhotos), [filteredPhotos]);

  return (
    <div style={{
      background: "#0a0a0a",
      borderTop: "1px solid #1a1a1a",
      padding: "12px 24px 16px",
      position: "relative",
    }}>
      {/* Active Filters Bar */}
      {activeFiltersCount > 0 && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          padding: "8px 12px",
          background: "rgba(168, 85, 247, 0.1)",
          borderRadius: 8,
          border: "1px solid rgba(168, 85, 247, 0.2)",
        }}>
          <span style={{ fontSize: 12, color: "#a855f7", fontWeight: 500 }}>
            {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""} active
          </span>
          <button
            onClick={onClear}
            style={{
              background: "none",
              border: "none",
              color: "#a855f7",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 4,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(168, 85, 247, 0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Quick Filters Row */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
        alignItems: "center",
      }}>
        {/* All / Favorites */}
        <FilterChip
          label="All"
          active={filters.favorite === "all"}
          onClick={() => updateFilter("favorite", "all")}
          count={photos.length}
        />
        <FilterChip
          label="Favorites"
          active={filters.favorite === true}
          onClick={() => updateFilter("favorite", true)}
          count={photos.filter(p => p.isFavorite).length}
        />
        <FilterChip
          label="Not Favorite"
          active={filters.favorite === false}
          onClick={() => updateFilter("favorite", false)}
          count={photos.filter(p => !p.isFavorite).length}
        />
      </div>

      {/* Category Filter */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          overflowX: "auto",
          paddingBottom: 8,
        }}>
          <FilterChip
            label="All Categories"
            active={filters.category === "all"}
            onClick={() => updateFilter("category", "all")}
            count={photos.length}
          />
          {PHOTO_CATEGORIES.slice(1).map(cat => (
            <FilterChip
              key={cat}
              label={cat}
              active={filters.category === cat}
              onClick={() => updateFilter("category", cat)}
              count={photos.filter(p => p.category === cat).length}
            />
          ))}
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "#666",
          cursor: "pointer",
          fontSize: 12,
          padding: "4px 8px",
          borderRadius: 4,
          marginBottom: showAdvanced ? 12 : 0,
          transition: "background 0.15s",
        }}
      >
        <Filter size={14} />
        <span>Advanced Filters</span>
        <RefreshCw
          size={14}
          style={{
            transform: `rotate(${showAdvanced ? 180 : 0}deg)`,
            opacity: showAdvanced ? 1 : 0.5,
          }}
        />
      </button>

      {/* Advanced Filter Options */}
      {showAdvanced && (
        <div style={{
          background: "#141414",
          borderRadius: 12,
          padding: 16,
          border: "1px solid #1e1e1e",
          marginBottom: 16,
        }}>
          {/* Date Range */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}>
              <Calendar size={16} color="#888" />
              <span style={{ fontSize: 12, color: "#aaa" }}>Date Range</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={filters.dateFrom?.toISOString().split("T")[0] || ""}
                onChange={e => updateFilter("dateFrom", e.target.value ? new Date(e.target.value) : null)}
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "inherit",
                  maxWidth: "50%",
                }}
                placeholder="From"
              />
              <input
                type="date"
                value={filters.dateTo?.toISOString().split("T")[0] || ""}
                onChange={e => updateFilter("dateTo", e.target.value ? new Date(e.target.value) : null)}
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "inherit",
                  maxWidth: "50%",
                }}
                placeholder="To"
              />
            </div>
          </div>

          {/* Camera Filter */}
          {uniqueCameras.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}>
                <Camera size={16} color="#888" />
                <span style={{ fontSize: 12, color: "#aaa" }}>Camera</span>
              </div>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}>
                <FilterChip
                  label="All Cameras"
                  active={filters.camera === "all"}
                  onClick={() => updateFilter("camera", "all")}
                />
                {uniqueCameras.map(camera => (
                  <FilterChip
                    key={camera}
                    label={camera}
                    active={filters.camera === camera}
                    onClick={() => updateFilter("camera", camera)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Aspect Ratio */}
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}>
              <Grid3x3 size={16} color="#888" />
              <span style={{ fontSize: 12, color: "#aaa" }}>Aspect Ratio</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <FilterChip
                label="All"
                active={filters.aspectRatio === "all"}
                onClick={() => updateFilter("aspectRatio", "all")}
              />
              <FilterChip
                label="Portrait"
                active={filters.aspectRatio === "portrait"}
                onClick={() => updateFilter("aspectRatio", "portrait")}
              />
              <FilterChip
                label="Square"
                active={filters.aspectRatio === "square"}
                onClick={() => updateFilter("aspectRatio", "square")}
              />
              <FilterChip
                label="Landscape"
                active={filters.aspectRatio === "landscape"}
                onClick={() => updateFilter("aspectRatio", "landscape")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderTop: "1px solid #1a1a1a",
        marginTop: 8,
      }}>
        <span style={{ fontSize: 12, color: "#666" }}>
          Showing {filteredPhotos.length} of {photos.length} photos
        </span>
      </div>
    </div>
  );
}