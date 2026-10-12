# Cat and Apollo reveal references

The reveals are original SVG illustrations. The photographs below were inspected as visual references; no reference photographs, paper figures or third-party drawings are bundled with the application. Every reveal has an optional [gentle soundtrack](REVEAL_SOUNDS.md); no NASA audio is included.

## Kitten & yarn (current)

The 8.5-second reveal is a storybook cartoon, not an anatomical study: a round ginger kitten with cream socks and big green eyes, drawn in `catArt.tsx` as a tree of rig nodes and choreographed in `catTimeline.ts`. A ball of yarn rolls in and she trots after it, notices it, tilts her head, wiggles and bunny-hops on. The tangle rolls under the cards and each knitted cover unravels from the top along its dangling yarn tail. She pops up out of the tangle in a striped beanie, gives the class a slow happy blink, and hops away behind the footer with the little ball rolling after her. Poses are sampled once into Web Animations (`bakedTimeline.ts`), so playback needs no per-frame React work. `catModelSheet.tsx` is a lab-only design aid (model sheets), not registered as a reveal. `tests/reveal-cat.test.ts` pins its beats.

It replaces the 6.8-second brown-tabby trot of earlier releases, which was built on a skeletal leg rig from photographs, Muybridge's cat plates (716, 717, 718, 720) and published feline gait studies. That rig, its references and its review notes remain in git history (before this revision, `catMotion.ts`, `catIllustration.tsx` and the earlier version of this file); none of it is used by the current reveal.

## Saturn V · Moon landing (current)

The 9.7-second reveal tells a compressed, playful mission on one scene clock (`moonTimeline.ts`, with art in `moonArt.tsx` and `apolloIllustration.tsx`): a 3-2-1 countdown, liftoff and a camera whip up through the clouds, two stage separations, a glint cut to the Moon, a dive to the surface, a hover that scoots past a boulder field, touchdown, the astronaut climbing down the ladder with the stowed flag, one giant leap, and the flag planted with a sparkle. A gold iris then closes the scene down onto the astronaut and flag, uncovering the groups around it, and pops away. Parking orbit, translunar injection and the multi-day coast are skipped.

The hardware is stylized but keeps recognizable features from NASA photographs: the slender Saturn V with its stage bands, the Columbia command ship, a gold angular 3/4-view Eagle with an off-center hatch, landing legs and pads, a white suit with a gold visor, and the U.S. flag (13 stripes, 50 stars, 10:19). Visual references:

- [NASA: Apollo 11 Lifts Off](https://www.nasa.gov/image-article/apollo-11-lifts-off-3/): Saturn V profile, stage bands and launch tower.
- [NASA: The Eagle Prepares to Land](https://science.nasa.gov/resource/the-eagle-prepares-to-land/): the lunar module's faceted cabin, gold foil and landing struts.
- [NASA: Apollo 11 Lunar Module on the surface](https://science.nasa.gov/resource/view-apollo-11-lunar-module-as-it-rested-on-lunar-surface/): the flat gray landing ground and long shadows.
- [NASA: Apollo 11 Mission Overview](https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/) and [One Small Step, One Giant Leap](https://www.nasa.gov/history/50-years-ago-one-small-step-one-giant-leap/): mission order, the ladder and first step, and the flag's support rod.

It replaces the 8.8-second, more literal mission illustration of earlier releases; that version's frame-by-frame review notes remain in git history. `tests/reveal-moon.test.ts` pins the current story beats.
