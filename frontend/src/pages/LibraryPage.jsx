import { useMemo, useState } from "react";
import { ChevronDown, Filter, Search, ShieldCheck, Sprout } from "lucide-react";

const healthyNote =
  "PlantVillage healthy-leaf class. A match does not rule out other crop problems.";
const diseaseNote =
  "PlantVillage image class label. Symptoms can overlap; confirm the cause with local crop-health expertise.";
const cottonNote =
  "Cotton dataset class. Visual similarity is not confirmation; verify symptoms with local crop-health expertise.";
const entries = [
  ["Apple", "Apple scab", "Fungal", diseaseNote],
  ["Apple", "Black rot", "Fungal", diseaseNote],
  ["Apple", "Cedar apple rust", "Fungal", diseaseNote],
  ["Apple", "Healthy", "Healthy", healthyNote],
  ["Blueberry", "Healthy", "Healthy", healthyNote],
  ["Cherry", "Powdery mildew", "Fungal", diseaseNote],
  ["Cherry", "Healthy", "Healthy", healthyNote],
  ["Corn", "Cercospora leaf spot / gray leaf spot", "Fungal", diseaseNote],
  ["Corn", "Common rust", "Fungal", diseaseNote],
  ["Corn", "Northern leaf blight", "Fungal", diseaseNote],
  ["Corn", "Healthy", "Healthy", healthyNote],
  ["Cotton", "Cotton Bacterial Blight", "Bacterial", cottonNote],
  ["Cotton", "Cotton Leaf Curl Virus", "Viral", cottonNote],
  ["Cotton", "Cotton Fusarium Wilt", "Fungal", cottonNote],
  ["Cotton", "Healthy Cotton", "Healthy", cottonNote],
  ["Grape", "Black rot", "Fungal", diseaseNote],
  ["Grape", "Esca (black measles)", "Fungal", diseaseNote],
  ["Grape", "Leaf blight (Isariopsis leaf spot)", "Fungal", diseaseNote],
  ["Grape", "Healthy", "Healthy", healthyNote],
  ["Orange", "Huanglongbing (citrus greening)", "Bacterial", diseaseNote],
  ["Peach", "Bacterial spot", "Bacterial", diseaseNote],
  ["Peach", "Healthy", "Healthy", healthyNote],
  ["Pepper", "Bacterial spot", "Bacterial", diseaseNote],
  ["Pepper", "Healthy", "Healthy", healthyNote],
  ["Potato", "Early blight", "Fungal", diseaseNote],
  ["Potato", "Late blight", "Oomycete", diseaseNote],
  ["Potato", "Healthy", "Healthy", healthyNote],
  ["Raspberry", "Healthy", "Healthy", healthyNote],
  ["Soybean", "Healthy", "Healthy", healthyNote],
  ["Squash", "Powdery mildew", "Fungal", diseaseNote],
  ["Strawberry", "Leaf scorch", "Fungal", diseaseNote],
  ["Strawberry", "Healthy", "Healthy", healthyNote],
  ["Tomato", "Bacterial spot", "Bacterial", diseaseNote],
  ["Tomato", "Early blight", "Fungal", diseaseNote],
  ["Tomato", "Late blight", "Oomycete", diseaseNote],
  ["Tomato", "Leaf mold", "Fungal", diseaseNote],
  ["Tomato", "Septoria leaf spot", "Fungal", diseaseNote],
  ["Tomato", "Spider mites (two-spotted spider mite)", "Pest", diseaseNote],
  ["Tomato", "Target spot", "Fungal", diseaseNote],
  ["Tomato", "Tomato yellow leaf curl virus", "Viral", diseaseNote],
  ["Tomato", "Tomato mosaic virus", "Viral", diseaseNote],
  ["Tomato", "Healthy", "Healthy", healthyNote],
];
const crops = [...new Set(entries.map((x) => x[0]))];
export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("");
  const filtered = useMemo(
    () =>
      entries.filter(
        ([c, d, t]) =>
          (!crop || crop === c) &&
          `${c} ${d} ${t}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [crop, query],
  );
  return (
    <div>
      <div className="page-lead compact">
        <div>
          <span className="eyebrow">REFERENCE, NOT DIAGNOSIS</span>
          <h2>Disease library</h2>
          <p>
            Browse PlantVillage and Cotton class references. Actual model
            coverage depends on the locally trained class-name file.
          </p>
        </div>
      </div>
      <div className="history-controls">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crop or disease"
          />
        </label>
        <label className="select-field">
          <Filter size={14} />
          <select value={crop} onChange={(e) => setCrop(e.target.value)}>
            <option value="">All crops</option>
            {crops.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <span className="result-count">{filtered.length} references</span>
      </div>
      <div className="library-grid">
        {filtered.map(([c, d, t, note]) => (
          <article className="panel disease-card" key={c + d}>
            <div className="disease-card-top">
              <span className="disease-crop">
                <Sprout size={13} />
                {c}
              </span>
              <span className="disease-type">{t}</span>
            </div>
            <h3>{d}</h3>
            <p>{note}</p>
            <div className="disease-card-bottom">
              <ShieldCheck size={14} />
              Verify locally before taking action
            </div>
          </article>
        ))}
        {!filtered.length && (
          <div className="empty-library">
            No library entries match those filters.
          </div>
        )}
      </div>
      <div className="library-caveat">
        <ShieldCheck size={15} />
        <p>
          General reference only, not a crop diagnosis or prescription. Follow
          local extension advice and pesticide labels.
        </p>
      </div>
    </div>
  );
}
