/**
 * AutoGenAdvanced — collapsible "Advanced" filters inside Auto Gen sheet.
 *
 * Sections (all optional, all collapse-friendly):
 *   - When   — date range (from / to) using native <input type="date">
 *              renders as iOS scroll wheel on iPhone, calendar on desktop
 *   - Hours  — time-of-day range using native <input type="time">
 *   - Tags   — category chips, OR logic (any chip matches)
 *   - Mix    — toggle that exposes 3 modes: Surprise / Discovery / Shuffle
 *   - Note   — freeform vibe textarea (passed to AI alongside filters)
 *
 * Returns the current filter state via the onChange callback. The parent
 * (AISuggestSheet) is responsible for applying the filter to its photo
 * pool before sending to the AI endpoint.
 */
import { useMemo } from "react";
import { ChevronDown, Shuffle, X } from "lucide-react";

export interface AutoGenFilters {
  /** YYYY-MM-DD or "" */
  dateFrom: string;
  dateTo: string;
  /** HH:MM (24h) or "" */
  timeFrom: string;
  timeTo: string;
  /** OR-stack of category names (case-insensitive match). Empty = no filter. */
  categories: string[];
  mix: {
    on: boolean;
    /** Ignore all filters, just pick randomly from the whole pool. */
    surprise: boolean;
    /** Shuffle input order each gen so re-pressing Auto Gen varies the pick. */
    shuffle: boolean;
  };
  vibeNote: string;
}

export var EMPTY_FILTERS: AutoGenFilters = {
  dateFrom: "",
  dateTo: "",
  timeFrom: "",
  timeTo: "",
  categories: [],
  mix: { on: false, surprise: false, shuffle: false },
  vibeNote: "",
};

interface AutoGenAdvancedProps {
  /** All categories currently present in the pool — used to render chips. */
  availableCategories: string[];
  open: boolean;
  onToggleOpen: () => void;
  value: AutoGenFilters;
  onChange: (next: AutoGenFilters) => void;
}

export default function AutoGenAdvanced({
  availableCategories,
  open,
  onToggleOpen,
  value,
  onChange,
}: AutoGenAdvancedProps) {
  var disabled = value.mix.on && value.mix.surprise;

  var sortedCats = useMemo(function() {
    var dedup: string[] = [];
    var seen: Record<string, boolean> = {};
    for (var i = 0; i < availableCategories.length; i++) {
      var c = (availableCategories[i] || "").trim();
      if (!c || seen[c.toLowerCase()]) continue;
      seen[c.toLowerCase()] = true;
      dedup.push(c);
    }
    dedup.sort();
    return dedup;
  }, [availableCategories]);

  function update(patch: Partial<AutoGenFilters>) {
    onChange(Object.assign({}, value, patch));
  }

  function updateMix(patch: Partial<AutoGenFilters["mix"]>) {
    onChange(Object.assign({}, value, { mix: Object.assign({}, value.mix, patch) }));
  }

  function toggleCategory(cat: string) {
    var has = value.categories.indexOf(cat) >= 0;
    var next = has
      ? value.categories.filter(function(c) { return c !== cat; })
      : value.categories.concat([cat]);
    update({ categories: next });
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  var hasAnyFilter =
    value.dateFrom || value.dateTo ||
    value.timeFrom || value.timeTo ||
    value.categories.length > 0 ||
    value.vibeNote.trim() ||
    value.mix.on;

  // Inline style helpers
  var sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
    textTransform: "uppercase" as const, color: "#888",
    marginBottom: 8,
  };
  var fieldRow: React.CSSProperties = {
    display: "flex", gap: 8, alignItems: "stretch",
  };
  var input: React.CSSProperties = {
    flex: 1, minWidth: 0,
    padding: "10px 12px",
    background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: 10, color: "#e8e8e8",
    fontSize: 13, fontFamily: "inherit",
    outline: "none",
    colorScheme: "dark" as React.CSSProperties["colorScheme"],
  };
  var inputDisabled: React.CSSProperties = Object.assign({}, input, {
    opacity: 0.4, pointerEvents: "none" as const,
  });
  var chipStyle = function(active: boolean, dim: boolean): React.CSSProperties {
    return {
      background: active ? "var(--accent)" : "transparent",
      color: active ? "#000" : "#888",
      border: active ? "none" : "1px solid #2a2a2a",
      borderRadius: 100, padding: "6px 12px",
      fontSize: 11, fontWeight: active ? 700 : 600,
      letterSpacing: "0.04em",
      cursor: dim ? "default" : "pointer",
      fontFamily: "inherit",
      opacity: dim ? 0.4 : 1,
      pointerEvents: dim ? ("none" as const) : ("auto" as const),
      transition: "all 0.15s",
    };
  };
  var smallToggle = function(on: boolean, dim?: boolean): React.CSSProperties {
    return {
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      background: on ? "rgba(var(--accent-rgb),0.10)" : "#141414",
      border: "1px solid " + (on ? "rgba(var(--accent-rgb),0.4)" : "#2a2a2a"),
      borderRadius: 10,
      cursor: dim ? "default" : "pointer",
      fontFamily: "inherit",
      fontSize: 12, fontWeight: 600,
      color: on ? "var(--accent)" : "#aaa",
      opacity: dim ? 0.4 : 1,
      pointerEvents: dim ? ("none" as const) : ("auto" as const),
    };
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header row — disclosure toggle */}
      <button
        type="button"
        onClick={onToggleOpen}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "transparent", border: "1px solid #1e1e1e",
          borderRadius: 10, padding: "10px 14px",
          color: "#aaa", fontSize: 12, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Advanced</span>
          {hasAnyFilter && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
              background: "rgba(var(--accent-rgb),0.15)",
              border: "1px solid rgba(var(--accent-rgb),0.35)",
              color: "var(--accent)", borderRadius: 100, padding: "2px 8px",
              textTransform: "uppercase" as const,
            }}>
              On
            </span>
          )}
        </span>
        <ChevronDown size={14} style={{
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
        }} />
      </button>

      {open && (
        <div style={{
          marginTop: 12,
          background: "#0c0c0c",
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          padding: 16,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Permanent hard rule — surfaced so users know why "used" photos
              never show up in suggestions. */}
          <div style={{
            fontSize: 10, color: "#666",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid #1e1e1e",
            borderRadius: 8, padding: "8px 10px",
            letterSpacing: "0.02em", lineHeight: 1.45,
          }}>
            Photos already in a dump are always skipped — Auto Gen only pulls from unused photos.
          </div>

          {/* Mix mode — top, since it can grey out everything below */}
          <div>
            <button
              type="button"
              onClick={function() { updateMix({ on: !value.mix.on }); }}
              style={smallToggle(value.mix.on)}
            >
              <Shuffle size={14} />
              <span style={{ flex: 1, textAlign: "left" }}>Mix it up</span>
              <span style={{
                fontSize: 10, color: value.mix.on ? "var(--accent)" : "#555",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, fontWeight: 700,
              }}>
                {value.mix.on ? "On" : "Off"}
              </span>
            </button>

            {value.mix.on && (
              <div style={{
                marginTop: 10, paddingLeft: 6,
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <CheckboxRow
                  label="Surprise me"
                  hint="Ignore filters — pick from whole pool"
                  checked={value.mix.surprise}
                  onChange={function(v) { updateMix({ surprise: v }); }}
                />
                <CheckboxRow
                  label="Shuffle on re-gen"
                  hint="Different result each time you press Auto Gen"
                  checked={value.mix.shuffle}
                  onChange={function(v) { updateMix({ shuffle: v }); }}
                />
              </div>
            )}
          </div>

          {/* When — date range */}
          <div>
            <div style={sectionLabel}>When</div>
            <div style={fieldRow}>
              <input
                type="date"
                value={value.dateFrom}
                onChange={function(e) { update({ dateFrom: e.target.value }); }}
                disabled={disabled}
                style={disabled ? inputDisabled : input}
                aria-label="Start date"
              />
              <input
                type="date"
                value={value.dateTo}
                onChange={function(e) { update({ dateTo: e.target.value }); }}
                disabled={disabled}
                style={disabled ? inputDisabled : input}
                aria-label="End date"
              />
            </div>
          </div>

          {/* Hours — time of day range */}
          <div>
            <div style={sectionLabel}>Time of day</div>
            <div style={fieldRow}>
              <input
                type="time"
                value={value.timeFrom}
                onChange={function(e) { update({ timeFrom: e.target.value }); }}
                disabled={disabled}
                style={disabled ? inputDisabled : input}
                aria-label="Start time"
              />
              <input
                type="time"
                value={value.timeTo}
                onChange={function(e) { update({ timeTo: e.target.value }); }}
                disabled={disabled}
                style={disabled ? inputDisabled : input}
                aria-label="End time"
              />
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6, letterSpacing: "0.04em" }}>
              Photos without EXIF time data are excluded.
            </div>
          </div>

          {/* Tags — category chips */}
          {sortedCats.length > 0 && (
            <div>
              <div style={sectionLabel}>Categories (any match)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sortedCats.map(function(c) {
                  var active = value.categories.indexOf(c) >= 0;
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={function() { toggleCategory(c); }}
                      disabled={disabled}
                      style={chipStyle(active, disabled)}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note — freeform vibe textarea */}
          <div>
            <div style={sectionLabel}>Anything else?</div>
            <textarea
              value={value.vibeNote}
              onChange={function(e) { update({ vibeNote: e.target.value }); }}
              placeholder="e.g. lean into the warm tones, save my best shot for slide 1"
              rows={2}
              style={Object.assign({}, input, {
                resize: "vertical" as const, minHeight: 50, lineHeight: 1.45,
              })}
            />
          </div>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "transparent", border: "none",
                color: "#666", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                alignSelf: "flex-end",
              }}
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxRow({
  label, hint, checked, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 4px",
      cursor: "pointer",
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={function(e) { onChange(e.target.checked); }}
        style={{
          width: 16, height: 16, accentColor: "var(--accent)",
          margin: 0, cursor: "pointer",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: checked ? "#fff" : "#ccc" }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 1, lineHeight: 1.3 }}>
          {hint}
        </div>
      </div>
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Filter application helper — kept here so callers can reuse the same logic
// for client-side filtering before sending to the AI endpoint.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Applies filters to a photo array. Returns a new (possibly shuffled) array
 * of photos that match. Photos without metadata are excluded from date/time
 * filters but pass through if filter is unset.
 *
 * HARD RULE: photos already used in an existing dump are ALWAYS excluded —
 * not a user-facing toggle. Even Surprise mode honors this.
 *
 * @param photos       Source pool
 * @param filters      Filter state from AutoGenAdvanced
 * @param usedIds      Photo IDs already used in existing dumps (always excluded)
 */
export function applyAutoGenFilters<T extends {
  id: string;
  category: string;
  meta?: { takenAt?: number };
}>(
  photos: T[],
  filters: AutoGenFilters,
  usedIds?: Set<string>
): T[] {
  // Pre-strip photos already used in dumps — applies to every code path below
  var pool0 = usedIds && usedIds.size > 0
    ? photos.filter(function(p) { return !usedIds.has(p.id); })
    : photos;

  // Surprise mode bypasses the *user-controlled* filters but still respects
  // the no-reuse hard rule above.
  if (filters.mix.on && filters.mix.surprise) {
    var pool = pool0.slice();
    if (filters.mix.shuffle) shuffleInPlace(pool);
    return pool;
  }

  var dateFromMs = filters.dateFrom ? Date.parse(filters.dateFrom + "T00:00:00") : null;
  var dateToMs = filters.dateTo ? Date.parse(filters.dateTo + "T23:59:59") : null;
  var timeFromMin = parseHM(filters.timeFrom);
  var timeToMin = parseHM(filters.timeTo);
  var cats: Record<string, boolean> = {};
  for (var i = 0; i < filters.categories.length; i++) {
    cats[filters.categories[i].toLowerCase()] = true;
  }
  var hasCatFilter = filters.categories.length > 0;

  var out: T[] = pool0.filter(function(p) {
    // Date range
    if (dateFromMs !== null || dateToMs !== null) {
      var ta = p.meta?.takenAt;
      if (typeof ta !== "number") return false;
      if (dateFromMs !== null && ta < dateFromMs) return false;
      if (dateToMs !== null && ta > dateToMs) return false;
    }
    // Time of day (hard window)
    if (timeFromMin !== null || timeToMin !== null) {
      var ta2 = p.meta?.takenAt;
      if (typeof ta2 !== "number") return false;
      var d = new Date(ta2);
      var minOfDay = d.getHours() * 60 + d.getMinutes();
      // Allow wrap-around (e.g. 22:00 → 02:00)
      if (timeFromMin !== null && timeToMin !== null && timeFromMin > timeToMin) {
        if (minOfDay < timeFromMin && minOfDay > timeToMin) return false;
      } else {
        if (timeFromMin !== null && minOfDay < timeFromMin) return false;
        if (timeToMin !== null && minOfDay > timeToMin) return false;
      }
    }
    // Category (OR)
    if (hasCatFilter && !cats[(p.category || "").toLowerCase()]) return false;
    return true;
  });

  if (filters.mix.on && filters.mix.shuffle) shuffleInPlace(out);
  return out;
}

function parseHM(s: string): number | null {
  if (!s) return null;
  var m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function shuffleInPlace<T>(a: T[]): void {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
}
