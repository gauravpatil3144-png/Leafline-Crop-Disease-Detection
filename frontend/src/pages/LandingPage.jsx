import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileImage,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";

const cropPhotos = [
  ["Tomato", "photo-1592841200221-a6898f307baa"],
  ["Grape", "photo-1515586000433-45406d8e6662"],
  ["Corn", "photo-1551754655-cd27e38d2076"],
  ["Potato", "photo-1518977676601-b53f82aba655"],
];
export default function LandingPage() {
  return (
    <main className="landing">
      <header className="marketing-nav wrap">
        <Brand />
        <nav>
          <a href="#approach">Approach</a>
          <a href="#crops">Crop library</a>
        </nav>
        <div className="nav-actions">
          <Link to="/login">Sign in</Link>
          <Link className="button button-dark button-small" to="/register">
            Get started <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">PLANT HEALTH, IN FOCUS</div>
          <h1>
            See what your
            <br />
            leaves are <em>telling you.</em>
          </h1>
          <p className="hero-lede">
            A clearer first look at crop health. Screen leaf photos, keep your
            observations together, and know when it’s time to ask an expert.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/register">
              Start a scan <ArrowRight size={15} />
            </Link>
            <a className="button button-quiet" href="#approach">
              How it works <ArrowDownRight size={14} />
            </a>
          </div>
          <div className="hero-note">
            <ShieldCheck size={15} />
            Preliminary AI screening. Field verification matters.
          </div>
        </div>
        <div className="hero-image-wrap">
          <img
            src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85"
            alt="Rows of crops growing in a green field"
          />
          <div className="image-stamp">
            <Leaf size={17} />
            <span>
              <strong>Better-informed growing</strong>
              <small>One leaf at a time</small>
            </span>
            <ArrowUpRight size={15} />
          </div>
          <span className="image-caption">FIELD NOTES · 01 / 04</span>
        </div>
      </section>
      <div className="ticker">
        <div className="ticker-track">
          {[
            "Observe closely",
            "Screen thoughtfully",
            "Verify in the field",
            "Observe closely",
            "Screen thoughtfully",
            "Verify in the field",
          ].map((text, i) => (
            <span key={i}>
              <i />
              {text}
            </span>
          ))}
        </div>
      </div>
      <section className="feature-band" id="approach">
        <div className="wrap feature-layout">
          <div className="section-intro">
            <div className="eyebrow">A PRACTICAL FIRST STEP</div>
            <h2>
              From leaf photo
              <br />
              to clearer next step.
            </h2>
            <p>
              Leafline helps organize what you see, without pretending a photo
              tells the whole story.
            </p>
            <Link className="text-link" to="/register">
              Explore the workspace <ArrowRight size={14} />
            </Link>
          </div>
          <div className="feature-list">
            <article>
              <span className="feature-num">01</span>
              <FileImage />
              <div>
                <h3>Capture a useful view</h3>
                <p>
                  Upload a clear leaf image in natural light. Get a quick check
                  before deciding what to do next.
                </p>
              </div>
            </article>
            <article>
              <span className="feature-num">02</span>
              <Activity />
              <div>
                <h3>Review the screening</h3>
                <p>
                  See the model’s leading matches and confidence, with
                  uncertainty called out plainly.
                </p>
              </div>
            </article>
            <article>
              <span className="feature-num">03</span>
              <BookOpen />
              <div>
                <h3>Keep observations together</h3>
                <p>
                  Return to scan history and use the disease library as a
                  starting point for questions.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="crop-section wrap" id="crops">
        <div className="crop-heading">
          <div>
            <div className="eyebrow">GROWER’S FIELD GUIDE</div>
            <h2>A growing list of familiar crops.</h2>
          </div>
          <Link className="text-link" to="/register">
            Browse crop library <ArrowRight size={14} />
          </Link>
        </div>
        <div className="crop-grid">
          {cropPhotos.map(([name, image], i) => (
            <article key={name} className="crop-tile">
              <img
                src={`https://images.unsplash.com/${image}?auto=format&fit=crop&w=650&q=80`}
                alt={`${name} crop`}
              />
              <div className="crop-overlay">
                <span>0{i + 1} / CROP</span>
                <h3>{name}</h3>
                <ArrowUpRight size={16} />
              </div>
            </article>
          ))}
        </div>
        <p className="dataset-note">
          PlantVillage crop groups: apple, blueberry, cherry, corn, grape,
          orange, peach, pepper, potato, raspberry, soybean, squash, strawberry,
          and tomato. Actual model coverage depends on its trained class set.
        </p>
      </section>
      <footer className="footer">
        <div className="wrap footer-inner">
          <Brand />
          <p>Good decisions start with a closer look.</p>
          <small>
            © 2026 Leafline · Preliminary screening, not a diagnosis.
          </small>
        </div>
      </footer>
    </main>
  );
}
