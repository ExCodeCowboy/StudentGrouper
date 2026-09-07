# Cat and Apollo reveal references

The two reveals are original SVG illustrations. These photographs were inspected as visual references; no reference photographs or paper figures are bundled with the application.

## Cat profile and gait

- [Purina: Cat Anatomy](https://www.purina.com/articles/cat/behavior/understanding-cats/cat-anatomy): side-profile photograph used for torso-to-leg proportions, head and muzzle scale, shoulder placement, and an open, lifted tail.
- [DOUXO: cat skin and coat](https://www.douxo.com/se/kattens-hud/mjaell-torr-hud): side-profile tabby photograph used for coat markings, haunch shape, ears, and the cream chin.
- [Rahmati et al., 2025, *Role of forelimb morphology in muscle sensorimotor functions during locomotion in the cat*](https://rybak-et-al.net/pdfs/Rahmati_et_al_2025.pdf): the anatomical model distinguishes scapula, upper arm, forearm, and distal foot. Its measured upper-arm and forearm lengths are similar. Its discussion identifies opposite elbow and knee flexion directions. These informed the segment hierarchy, proportions, and bend branches in our drawing.
- [Klishko et al., 2014, *Stabilization of cat paw trajectory during locomotion*](https://journals.physiology.org/doi/full/10.1152/jn.00663.2013): uses three rigid segments for both forelimb and hindlimb, and geometric joint reconstruction. This informed the separate wrist/hock, constant segment lengths, and planted-foot motion.
- [Frigon et al., 2014, *Speed-dependent modulation of phase variations…during quadrupedal locomotion in intact adult cats*](https://journals.physiology.org/doi/full/10.1152/jn.00524.2013): informed the earlier walking version. The current reveal uses a playful trot rather than that four-beat walk.
- [Bishop et al., 2008, *Whole Body Mechanics of Stealthy Walking in Cats*](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0003808): distinguishes a trot by opposite-side diagonal support, with same-side front and hind contacts separated by half a stride. The revised rig uses alternating diagonal pairs and a short interval off the ground between supports.

### Sequential pose references

A dedicated research pass located and visually inspected the following sequences at their museum or creator sources:

- [Muybridge, plate 718 — cat trotting, changing to galloping](https://www.nga.gov/artworks/220471-plate-number-718-cat-trotting-change-galloping): 24 side-profile photographs. The early trot frames are the main timing comparison; later frames show much greater compression and extension as the cat gallops. The National Gallery of Art identifies the media as public domain.
- [Muybridge, plate 717](https://www.pafa.org/museum/collection/item/animal-locomotion-volume-x-domestic-animals-plate-717): 20 photographs offering another view of shoulder, haunch, and head carriage. The [Penn catalogue](https://archives.upenn.edu/collections/finding-aid/upt50m993/) identifies this as trotting, changing to galloping. PAFA lists no known copyright restrictions.
- [Muybridge, plate 716 — cat walking, changing to galloping](https://www.nga.gov/artworks/220470-plate-number-716-cat-walking-change-galloping): 24 photographs useful for upright silhouette and tail carriage. It is not a pure trot cycle. NGA identifies the media as public domain.
- [Muybridge, plate 720 — cat galloping](https://www.loc.gov/pictures/item/98514094/): 24 photographs used to distinguish galloping's stronger spinal compression from the gentler trot. The Library of Congress lists no known publication restrictions.
- [Yhel Rogero, *Cat Run Cycle*](https://yhelrogero.artstation.com/projects/181Lxo): an original nine-drawing sheet and an overlapping-pose study, useful for construction and overlapping body masses. This depicts a run/gallop, not trot timing. The creator reserves rights; the drawings are not copied into our illustration or bundled with the application.

The user also supplied a drawn pose sheet. Its authorship is unverified, so it remains a local comparison reference. The ignored `work/cat-gait-study.html` helper displays that sheet, the original profile photographs, or plate 718 beside six rendered phases and a playable cycle. It also offers 24 stride frames, 12 stopping/restarting frames, before/after comparison, and a silhouette view. Reference images and the saved earlier illustration are not production assets.

### Implementation

`catRig` supplies the four leg chains, three torso sections, and the neck/head controls. Front chains are shoulder–elbow–wrist–toes; rear chains are hip–knee–hock–toes. Bone lengths remain fixed as inverse kinematics solves the elbow or knee. A raised rear hock is kept distinct from the knee inside the haunch.

The pelvis, lumbar section, and ribcage use small counter-rotations. Neighboring transforms blend over one continuous body outline; coat stripes follow that deformation. The leg roots follow the same body rig. Shoulder blades glide and haunch markings follow their upper joints. The neck connects to the chest, and the head counter-rotates at its own pivot. The torso is lifted seven drawing units for a less crouched stance. The playful trot uses a 288-unit stride, 44% stance and a 36-unit paw lift; the 3.2-unit torso bounce peaks between contacts. A delayed tail curl and swing, plus a little head follow-through, add liveliness without speeding up the scene or changing to a gallop. These amplitudes are artistic choices, with bone reach verified throughout the cycle and pause.

Filled leg silhouettes taper from the upper muscles to the wrist/hock and merge into compact paws. The croup has a flatter top and tapers diagonally into the thigh; a small elongated highlight and short diagonal stripes replace the earlier circular hip shading. The body-edge mask omits strokes across emerging legs, while a short fading contour describes the near thigh where it overlaps the flank. The throat narrows behind the jaw and broadens into the chest; small ears, a tucked abdomen, and a rounded tail tip refine the overall profile. Toes tuck by up to ten degrees during swing and settle flat before contact. Feet stay stationary against the ground during stance. The acting pause keeps three support footprints stationary while the near forepaw lifts and taps the yarn.

The September 7 silhouette revision was visually inspected at all 24 evenly sampled stride phases and 12 times around the pause/restart (2.45, 2.55, 2.60, 2.65, 2.72, 2.80, 3.02, 3.35, 3.40, 3.48, 3.55, and 3.65 seconds), plus enlarged before/after and silhouette comparisons. The denser review exposed the old torso stroke across the thigh and drove the overlap contour correction.

### Character and acting revision

The subsequent animation-direction review found that credible anatomy alone did not communicate a character: the yarn and cat maintained the same gap, the pause lacked a readable thought, and the secondary motion was mostly periodic. The revised performance gives the yarn and cat separate blocking, with a shared coordinate system for actual paw contact:

| Beat | Timing and intention |
| --- | --- |
| Notice | Yarn begins braking at 2.10 s; eyes and ears react from 2.12, head from 2.24, and chest from 2.37. |
| Catch up | Yarn rests at 2.40; cat settles at 2.65 in a balanced pose determined by a responsive stride offset. |
| Consider | Near forepaw lifts while the other three feet stay planted; head, paw, and tail hold from 2.94–3.06. |
| Tap | Paw meets the yarn at 3.22 and follows through until 3.30. The ball receives an immediate impulse, finishes accelerating during that short push, then coasts. |
| Follow | Head leads the decision from 3.50, hindquarters prepare to push, cat travels again from 3.75, and the tail finishes afterward. Yarn stays ahead through the exit. |

`catActing` supplies the attention, body weight, paw gesture, and overlapping tail beats. `catBlocking` supplies responsive scene travel, stride offset, and independent yarn position/rotation. The tail root follows the skinned pelvis before its delayed rotation, so expressive weight shifts keep it attached. The eye opens with attention, ears rotate independently, and the shorter tail crook gives the face more emphasis. The total duration remains 6.8 seconds.

The ignored `work/cat-acting-review.html` renders the actual scene at fixed viewport sizes rather than changing the layout to fit each thumbnail. It provides 30 poses across notice, consideration, touch, recommitment, and exit, plus normal/slow playback and an enlarged detail view. The reviewer requested two further timing refinements: immediate yarn response at contact instead of a walking-style acceleration, and the brief held consideration pose. After both refinements, the reviewer approved the restrained, curious performance, citing the readable thought, visible contact/consequence, and head-led return to the trot. The review covered 30 acting/exit poses at laptop size, enlarged contact, and the held pose at 1280×720.

This is a stylized 2D trot, not motion capture or a veterinary simulation. Tests check constant leg lengths, bend direction, toe clearance, moving upper joints, diagonal contacts, brief suspension, near-matching front/rear footprints, and pause continuity. The actual scene is sampled every 5 ms at widths 640, 960, 1280, and 1920; checks cover three stationary support paws, gesture return, responsive paw-to-ball contact, independent yarn stopping, prompt response to the tap, and forward reveal clearance. Fixed-time browser renders inspect the silhouette and acting over the rig.

## Apollo mission

- [NASA: Apollo 11 Lifts Off](https://www.nasa.gov/image-article/apollo-11-lifts-off-3/): slender Saturn V profile, stage bands, vertical lettering, bright exhaust core, and launch-tower proportions.
- [NASA: The Eagle Prepares to Land](https://science.nasa.gov/resource/the-eagle-prepares-to-land/): asymmetric faceted cabin, dark thermal blankets, gold foil, landing struts, antennas, and sensing probes. NASA's description of the probes informed the engine-cutoff moment.
- [NASA: Apollo 11 Lunar Module on the surface](https://science.nasa.gov/resource/view-apollo-11-lunar-module-as-it-rested-on-lunar-surface/): flatter landing horizon, neutral gray ground, fine surface texture, and crisp directional shadows.
- [NASA: Apollo 11 Mission Overview](https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/): mission chronology, three-stage ascent, translunar injection, docking/extraction, and coast.
- [NASA: One Small Step, One Giant Leap](https://www.nasa.gov/history/50-years-ago-one-small-step-one-giant-leap/): landing gear before undocking, descent, contact and shutdown, ladder/footpad/first-step sequence, and the flag's support rod. The review also compared its photographs of Eagle after undocking (AS11-44-6585), Aldrin on the ladder (AS11-40-5868), and flag installation (AP11-S69-40308).

Hardware, foil highlights, and suit details are drawn in `apolloIllustration.tsx`. The revised sequence retracts the service arms, separates the first and second stages, delays each following ignition until there is clearance, and jettisons the escape tower. Third-stage thrust comes from one engine. Eagle deploys its gear while docked; Columbia separates from its upper hatch before descent. On the Moon, sensing probes bend on contact, dust skims the ground, and pads and directional shadows anchor the lander to the surface. The astronaut descends facing the ladder, steps away, turns, and waves. The flag has a rigid support rod.

The 8.8-second sequence compresses the mission into a classroom story and uses a U.S. flag with 13 stripes and 50 stars. Earth parking orbit, translunar injection, transposition/extraction, and the multi-day coast are omitted through a dissolve. The ignored `work/apollo-review.html` helper states that compression and provides 48 fixed frames in six phase chapters, playback, and compact/wide layouts without touching classroom data. All 48 frames were visually inspected on September 7, with extra checks at 960×680 and 1280×536.

An independent animation-director review of both stories recommended the restrained paw articulation and more recognition time for the docked spacecraft. The stack now becomes fully visible at 3.72 seconds, with legs extended at 3.74 and undocking beginning at 3.93. The affected stride/pause poses, docking boundaries, and U.S. flag frames were rechecked after those refinements.

| Review chapter | Scene times inspected (seconds) |
| --- | --- |
| Ignition and liftoff | 0, .12, .30, .55, .75, 1.10, 1.65, 2.12 |
| Three-stage ascent | 2.25, 2.36, 2.55, 2.80, 2.98, 3.10, 3.25, 3.46 |
| Lunar orbit and undocking | 3.55, 3.72, 3.74, 3.88, 3.93, 4.05, 4.18, 4.42 (also 4.65 before the final hold adjustment) |
| Descent and surface contact | 4.90, 5.15, 5.45, 5.60, 5.68, 5.74, 5.85, 5.98 |
| Hatch, ladder, and first step | 6.04, 6.15, 6.25, 6.35, 6.43, 6.55, 6.73, 6.88 |
| Flag and classroom reveal | 6.96, 7.02, 7.20, 7.45, 7.75, 8.20, 8.65, 8.80 |
