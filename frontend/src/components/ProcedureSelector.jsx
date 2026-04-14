import { useCallback, useEffect, useRef, useState } from "react";
import { getAllProcedures, searchProcedures } from "../data/costEngine";

const { categories } = getAllProcedures();

const CATEGORY_ORDER = [
  "Musculoskeletal", "Radiology & Imaging", "Gastrointestinal", "Obstetrics",
  "Reproductive", "ENT", "Ophthalmology", "Pulmonary", "Neurology", "Diagnostic",
];

const CATEGORY_ICONS = {
  Musculoskeletal: "🦴", "Radiology & Imaging": "📷", Gastrointestinal: "🔬",
  Obstetrics: "👶", Reproductive: "👩‍⚕️", ENT: "👂", Ophthalmology: "👁️",
  Pulmonary: "🫁", Neurology: "🧠", Diagnostic: "🔍",
};

const PROC_DISPLAY = {
  ankle_arthro: 'Ankle Repair - Arthroscopic',
  finger_fracture: 'Articular Finger Fracture Repair - Surgical',
  breast_mri: 'Breast MRI',
  breast_ultrasound: 'Breast Ultrasound',
  bronchoscopy: 'Bronchoscopy',
  carpal_tunnel: 'Carpal Tunnel Repair',
  cataract: 'Cataract Removal with Intraocular Lens Insertion',
  clavicle_repair: 'Clavicle/Scapula Repair - Non-Surgical',
  colonoscopy: 'Colonoscopy',
  colonoscopy_stoma: 'Colonoscopy via Stoma',
  ct: 'CT',
  ct_abdomen_pelvis: 'CT of Abdomen and Pelvis',
  cesarean: 'Delivery - Cesarean',
  vaginal_delivery: 'Delivery - Vaginal',
  egd: 'Esophagogastroduodenoscopy, Simple',
  fetal_mri: 'Fetal MRI',
  fna_biopsy: 'Fine Needle Aspiration Biopsy with Ultrasound Guidance',
  wrist_repair: 'Forearm/Wrist Repair - Non-Surgical',
  hernia_lap: 'Hernia Repair - Laparoscopic',
  hernia_open: 'Hernia Repair - Non-Laparoscopic',
  hip_arthro: 'Hip Repair - Arthroscopic',
  hysteroscopy: 'Hysteroscopy with Surgical Procedure',
  knee_arthro: 'Knee Repair - Arthroscopic',
  lap_ovary: 'Laparoscopic Surgery of Ovaries and/or Fallopian Tubes',
  mammogram: 'Mammogram',
  mri_contrast: 'MRI with Contrast',
  mri_no_contrast: 'MRI without Contrast',
  breast_biopsy: 'Percutaneous Breast Biopsy',
  shoulder_arthro: 'Shoulder Repair, Complex - Arthroscopic',
  tonsil_child: 'Tonsil and Adenoid Removal (Child Under 12)',
  tonsil: 'Tonsil and/or Adenoid Removal',
  ultrasound: 'Ultrasound',
  xray: 'X-Ray',
};

export default function ProcedureSelector({ onChange }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof onChangeRef.current === "function") {
      onChangeRef.current(selected ? [{ name: PROC_DISPLAY[selected] || selected, id: selected }] : []);
    }
  }, [selected]);

  useEffect(() => {
    if (query.length > 0) {
      const results = searchProcedures(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectProcedure = useCallback((id) => {
    setSelected(id);
    setQuery("");
    setIsOpen(false);
    setActiveCategory(null);
  }, []);

  const clearSelection = () => {
    setSelected(null);
    setQuery("");
  };

  const showSearch = query.length > 0;
  const showCategories = !showSearch;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {selected && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          padding: "10px 16px", background: "var(--accent-soft)", border: "1px solid var(--accent)",
          borderRadius: "var(--radius-lg)", fontSize: 14, color: "var(--text)", fontWeight: 500,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span style={{ flex: 1 }}>{PROC_DISPLAY[selected] || selected}</span>
          <button type="button" onClick={clearSelection} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "var(--text-3)", fontSize: 18, lineHeight: 1, padding: 0,
          }}>×</button>
        </div>
      )}

      <div style={{
        position: "relative", display: "flex", alignItems: "center",
        background: "var(--surface-2)", border: `2px solid ${isOpen ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)", padding: "0 16px",
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        boxShadow: isOpen ? "0 0 0 3px var(--accent-soft)" : "none",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for care (e.g. colonoscopy, MRI, knee repair)..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          style={{
            flex: 1, border: "none", background: "transparent", outline: "none",
            padding: "14px 12px", fontSize: 15, color: "var(--text)",
            fontFamily: "inherit",
          }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "var(--text-3)", fontSize: 16, padding: 4,
          }}>×</button>
        )}
      </div>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          zIndex: 100, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
          maxHeight: 440, overflowY: "auto",
        }}>
          {showSearch && (
            <div>
              {searchResults.length === 0 ? (
                <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
                  No procedures found for "{query}"
                </div>
              ) : (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectProcedure(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") selectProcedure(p.id); }}
                    style={{
                      display: "flex", alignItems: "center", padding: "12px 20px",
                      cursor: "pointer", fontSize: 14, color: "var(--text)",
                      borderBottom: "1px solid var(--surface-2)",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ marginRight: 12, flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {showCategories && (
            <div>
              <div style={{ padding: "12px 20px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Browse by category
              </div>
              {activeCategory ? (
                <div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveCategory(null)}
                    style={{
                      display: "flex", alignItems: "center", padding: "10px 20px",
                      cursor: "pointer", fontSize: 13, color: "var(--accent)",
                      fontWeight: 600, borderBottom: "1px solid var(--surface-2)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}>
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to categories
                  </div>
                  {(categories[activeCategory] || []).map(procId => (
                    <div
                      key={procId}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectProcedure(procId)}
                      onKeyDown={(e) => { if (e.key === "Enter") selectProcedure(procId); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 20px", cursor: "pointer", fontSize: 14, color: "var(--text)",
                        borderBottom: "1px solid var(--surface-2)",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span>{PROC_DISPLAY[procId] || procId}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                CATEGORY_ORDER.map(cat => (
                  <div
                    key={cat}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveCategory(cat)}
                    onKeyDown={(e) => { if (e.key === "Enter") setActiveCategory(cat); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 20px", cursor: "pointer", fontSize: 14, color: "var(--text)",
                      borderBottom: "1px solid var(--surface-2)",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat] || "🏥"}</span>
                      <span style={{ fontWeight: 500 }}>{cat}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                        {(categories[cat] || []).length} procedures
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
