import { ParticleOrb } from "../../components/ParticleOrb";
import "./HomeOrb.css";

export function HomeOrb() {
  return <div className="home-orb" aria-hidden="true">
    <span className="home-orb-scan" />
    <ParticleOrb className="home-orb-particles" connections />
    <span className="home-orb-book">
      <span className="home-orb-book-page home-orb-book-left" />
      <span className="home-orb-book-page home-orb-book-right" />
      <span className="home-orb-book-spine" />
      <span className="home-orb-book-cross" />
    </span>
    <span className="home-orb-status" />
  </div>;
}
