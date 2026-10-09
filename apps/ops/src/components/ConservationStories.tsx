import { Reveal } from "./Reveal.js";
import { ParallaxCarousel } from "./ParallaxCarousel.js";
import { conservationStories } from "../data/conservationStories.js";

export function ConservationStories() {
  return (
    <section
      id="conservation-stories"
      className="conservation-stories section-space"
      aria-labelledby="stories-title"
    >
      <div className="content-width">
        <Reveal>
          <div className="stories-heading">
            <p className="section-kicker">04 / CONSERVATION IN ACTION</p>
            <div className="section-title-row">
              <h2 id="stories-title">
                From the field
                <br />
                to a decision.
              </h2>
              <p>
                Six everyday moments the platform is built for, each one a
                working part of this prototype. Photos are illustrative.
              </p>
            </div>
          </div>
        </Reveal>
        <ParallaxCarousel slides={conservationStories} />
      </div>
    </section>
  );
}
