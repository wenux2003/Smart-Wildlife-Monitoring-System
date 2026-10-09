import type { StorySlide } from "../components/ParallaxCarousel.js";

// Each card describes a workflow the prototype actually supports. The photographs are
// illustrative public images (credited below), not records produced by the platform.
export const conservationStories: StorySlide[] = [
  {
    id: "village-fields",
    src: "/images/stories/village-fields.webp",
    alt: "Paddy fields at the edge of a village in Sri Lanka",
    category: "Community reports",
    title: "A text message from the village edge.",
    description:
      "A farmer sends “ELEPHANT herd in the paddy @ Galge entrance”. The known landmark gives an approximate location and the report reaches the liaison officer’s inbox. No smartphone or account needed.",
    credit: "HarshaX4",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Paddy_field_in_sri_lanka.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    id: "road-crossing",
    src: "/images/stories/road-crossing.webp",
    alt: "A herd of elephants crossing a road near Minneriya, Sri Lanka",
    category: "Collar alerts",
    title: "A collared herd heads for the road.",
    description:
      "When a collared elephant enters a mapped risk zone, an alert opens with the nearest villages and available rangers, so a manager can dispatch someone before anyone gets hurt.",
    credit: "Indrajith1598",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Who%27s_crossing.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    id: "park-track",
    src: "/images/stories/park-track.webp",
    alt: "Elephants beside a vehicle on a track in Yala National Park",
    category: "Ranger patrols",
    title: "A snare logged with no signal.",
    description:
      "On patrol, a ranger photographs a wire snare and saves it with GPS on the phone. The patrol track and the report sync automatically once the phone is back in range.",
    credit: "Hanavihash",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Jeep_Safari_in_Yala_National_Park,Sri_Lanka.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    id: "camera-trap",
    src: "/images/stories/camera-trap.webp",
    alt: "A leopard photographed at night by a camera trap",
    category: "Camera-trap review",
    title: "A night frame waits for a human eye.",
    description:
      "Staff classify each frame as wildlife, an authorised person or suspicious activity. A person in the picture is never treated as poaching until a reviewer decides it is.",
    credit: "MSGNP",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Camera_trap_4.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
  },
  {
    id: "elephant-care",
    src: "/images/stories/elephant-care.webp",
    alt: "Young elephants at the Udawalawe Elephant Transit Home",
    category: "Incident response",
    title: "From a report to a recorded outcome.",
    description:
      "An injured-animal report is verified, a ranger is assigned and the response is tracked through to the outcome notes, so the next team knows exactly what happened.",
    credit: "Z thomas",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Udawalawe_Elephant_Transit_Home_2017-10-27_(31).jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    id: "elephant-fence",
    src: "/images/stories/elephant-fence.webp",
    alt: "Electric fence for elephants beside a road in Sri Lanka",
    category: "Conservation insights",
    title: "Which fence line needs attention?",
    description:
      "Monthly conflict counts for each boundary stretch, hotspots and patrol gaps show managers where to act, and export as audited PDF and CSV reports for funders and ministries.",
    credit: "Cherubino",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Electric_fence_for_Elephants_B-295_Sri_Lanka.JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
  },
];
