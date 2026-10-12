import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APEX, BED_POOF, BED_POOF_DELAY, BREATH, DEEP_REBOUND, HIT_RISE_EASE, HIT_SQUASH_EASE, RECOVER, easeAt, BUDDY_BODY, BUDDY_EXTRAS, BUDDY_FACES, BUDDY_SPIN, BUDDY_X, BUDDY_Y, COVERS_GONE, DEEP_SINK, DIZZY, DROP, DURATION, FLIP,
  FACE_SPLAT_KEYS, FLOOR, FLY, GENERATED_BEGIN, GENERATED_END, GONE, HIT_ECHO_CAP, HIT_PATTERNS, HOLD, HOP, INFLATE, LANDINGS, PANCAKE, RELIEVED, REVEALED_BY, ROUND,
  SAFETY_FADE, SAFETY_FADE_AT, SHADOW, SHADOW_Y, SHOCK, SHOCK_ECHO, SHOCK_FROM, SILENT_WINDOWS, SINK, SOUND_BEATS, SPLAT, SPLAT_DURATION, SPLAT_HOLD, SPLAT_HOLD_EASE, SPLAT_KEYS, SPLAT_SPREAD,
  SPLAT_SQUASH_EASE, SPLAT_TREMBLE, SQUISHY_DURATION_MS, TAKEOFF, TOSS, TOSS_POP, TOSS_UP, FLIP_DELAY, BOING_STRETCH,
  UH_OH, UNFLAT, WINK, WINK_END, DUCK, IMPACT, PANCAKE_HIT, FACE_LEAD, FLY_EASE, BOING_LIFT, type Ease, Z_DURATION, Z_LAG, Z_STAGGER, Z_START, faceAt, faceHitKeys, hitDuration, hitKeys, holdVar, squishyKeyframesCss, withGeneratedBlock, type BuddyFace, type Key,
} from '../src/revealEffects/squishyBounceTimeline';
import {
  FLOOR_TUCK, FOOTER_HEIGHT, HEADER_SAFE, SPLAT_MAX_Y, SPLAT_MIN_PX, HOP_ROOM, MIN_PILLOW, PEEK_TUCK, PILLOW_INSET_BOTTOM, PILLOW_INSET_TOP, POPCORN_HEIGHT, RIM_SINK, TIMING_VARS, TOSS_SIDE, buddySize, geometryVars, coverClip,
  freeRestSpans, landingColumns, landingFraction, planRest, planSquishyBounce, restBand, restBox, rowTops, shownFraction, type Box, type Rect,
} from '../src/revealEffects/squishyBouncePlan';
import { SQUISHY_COVER_HTML, squishyBounceEffect } from '../src/revealEffects/squishyBounce';

const CSS_PATH = 'src/revealEffects/squishyBounce.css';
const TSX_PATH = 'src/revealEffects/squishyBounce.tsx';
const EPS = 1e-9;
const times = (keys: readonly Key[]) => keys.map(([time]) => time);
const valueAt = (keys: readonly Key[], time: number) => keys.filter(([t]) => Math.abs(t - time) < 1e-9).map(([, value]) => value);
/** The Y scale a cover's pillow track renders at time t (its keys, with the cover's own variables and each key's easing, as the browser plays them). */
function scaleYAt(keys: readonly Key[], vars: Record<string, string>, t: number): number {
  const y = (value: string) => {
    const match = /scale\((?:var\((--[\w-]+)\)|([\d.]+)),(?:var\((--[\w-]+)\)|([\d.]+))\)/.exec(value);
    assert.ok(match, `a scale in ${value}`);
    return match[3] ? Number(vars[match[3]]) : Number(match[4]);
  };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= t + 1e-9) i++;
  if (i + 1 >= keys.length || Math.abs(keys[i][0] - t) < 1e-9) return y(keys[i][1]);
  const [from, value, ease] = keys[i];
  const [to, next] = keys[i + 1];
  return y(value) + (y(next) - y(value)) * easeAt((ease ?? 'lin') as Ease, (t - from) / (to - from));
}

// Cover rectangles recorded in the review lab (viewport px): [left, top, width, height].
const LAYOUTS: Record<string, { vp: [number, number]; r: [number, number, number, number][] }> = {
  'groups-1@1280x800': { vp: [1280, 800], r: [[24, 74, 1217, 636.5]] },
  'groups-4@1280x800': { vp: [1280, 800], r: [[24, 74, 289.25, 636.5], [333.25, 74, 289.25, 636.5], [642.5, 74, 289.25, 636.5], [951.75, 74, 289.25, 636.5]] },
  'groups-5@1280x800': { vp: [1280, 800], r: [[24, 74, 227.39, 636.5], [271.39, 74, 227.41, 636.5], [518.8, 74, 227.39, 636.5], [766.19, 74, 227.41, 636.5], [1013.59, 74, 227.39, 636.5]] },
  'groups-6@1280x800': { vp: [1280, 800], r: [[24, 74, 392.33, 308.25], [436.33, 74, 392.33, 308.25], [848.66, 74, 392.34, 308.25], [24, 402.25, 392.33, 308.25], [436.33, 402.25, 392.33, 308.25], [848.66, 402.25, 392.34, 308.25]] },
  'groups-8@1280x800': { vp: [1280, 800], r: [[24, 74, 289.25, 308.25], [333.25, 74, 289.25, 308.25], [642.5, 74, 289.25, 308.25], [951.75, 74, 289.25, 308.25], [24, 402.25, 289.25, 308.25], [333.25, 402.25, 289.25, 308.25], [642.5, 402.25, 289.25, 308.25], [951.75, 402.25, 289.25, 308.25]] },
  'groups-12@1280x800': { vp: [1280, 800], r: [[24, 74, 289.25, 231.06], [333.25, 74, 289.25, 231.06], [642.5, 74, 289.25, 231.06], [951.75, 74, 289.25, 231.06], [24, 325.06, 289.25, 231.06], [333.25, 325.06, 289.25, 231.06], [642.5, 325.06, 289.25, 231.06], [951.75, 325.06, 289.25, 231.06], [24, 576.13, 289.25, 231.06], [333.25, 576.13, 289.25, 231.06], [642.5, 576.13, 289.25, 231.06], [951.75, 576.13, 289.25, 231.06]] },
  'groups-4@960x680': { vp: [960, 680], r: [[24, 74, 285.66, 257.75], [329.66, 74, 285.67, 257.75], [635.33, 74, 285.66, 257.75], [24, 351.75, 285.66, 257.75]] },
  'groups-8@960x680': { vp: [960, 680], r: [[24, 74, 285.66, 257.75], [329.66, 74, 285.67, 257.75], [635.33, 74, 285.66, 257.75], [24, 351.75, 285.66, 257.75], [329.66, 351.75, 285.67, 257.75], [635.33, 351.75, 285.66, 257.75], [24, 629.5, 285.66, 257.75], [329.66, 629.5, 285.67, 257.75]] },
  'groups-12@960x680': { vp: [960, 680], r: [[24, 74, 285.66, 217.56], [329.66, 74, 285.67, 217.56], [635.33, 74, 285.66, 217.56], [24, 311.56, 285.66, 217.56], [329.66, 311.56, 285.67, 217.56], [635.33, 311.56, 285.66, 217.56], [24, 549.13, 285.66, 217.56], [329.66, 549.13, 285.67, 217.56], [635.33, 549.13, 285.66, 217.56], [24, 786.69, 285.66, 217.56], [329.66, 786.69, 285.67, 217.56], [635.33, 786.69, 285.66, 217.56]] },
  'groups-6@1920x1080': { vp: [1920, 1080], r: [[24, 74, 292.83, 916.5], [336.83, 74, 292.83, 916.5], [649.66, 74, 292.84, 916.5], [962.5, 74, 292.83, 916.5], [1275.33, 74, 292.83, 916.5], [1588.16, 74, 292.84, 916.5]] },
  'groups-12@1920x1080': { vp: [1920, 1080], r: [[24, 74, 292.83, 448.25], [336.83, 74, 292.83, 448.25], [649.66, 74, 292.84, 448.25], [962.5, 74, 292.83, 448.25], [1275.33, 74, 292.83, 448.25], [1588.16, 74, 292.84, 448.25], [24, 542.25, 292.83, 448.25], [336.83, 542.25, 292.83, 448.25], [649.66, 542.25, 292.84, 448.25], [962.5, 542.25, 292.83, 448.25], [1275.33, 542.25, 292.83, 448.25], [1588.16, 542.25, 292.84, 448.25]] },
  'rotations-5@1280x800': { vp: [1280, 800], r: [[348.25, 123, 269.25, 76], [646.5, 123, 269.25, 76], [944.75, 123, 270.25, 76], [348.25, 216, 269.25, 76], [646.5, 216, 269.25, 76], [944.75, 216, 270.25, 76], [348.25, 309, 269.25, 76], [646.5, 309, 269.25, 76], [944.75, 309, 270.25, 76], [348.25, 402, 269.25, 76], [646.5, 402, 269.25, 76], [944.75, 402, 270.25, 76], [348.25, 495, 269.25, 76], [646.5, 495, 269.25, 76], [944.75, 495, 270.25, 76]] },
  'rotations-8@1280x800': { vp: [1280, 800], r: [[348.25, 123, 269.25, 76], [646.5, 123, 269.25, 76], [944.75, 123, 270.25, 76], [348.25, 216, 269.25, 76], [646.5, 216, 269.25, 76], [944.75, 216, 270.25, 76], [348.25, 309, 269.25, 76], [646.5, 309, 269.25, 76], [944.75, 309, 270.25, 76], [348.25, 402, 269.25, 76], [646.5, 402, 269.25, 76], [944.75, 402, 270.25, 76], [348.25, 495, 269.25, 76], [646.5, 495, 269.25, 76], [944.75, 495, 270.25, 76], [348.25, 588, 269.25, 76], [646.5, 588, 269.25, 76], [944.75, 588, 270.25, 76], [348.25, 681, 269.25, 76], [646.5, 681, 269.25, 76], [944.75, 681, 270.25, 76], [348.25, 774, 269.25, 76], [646.5, 774, 269.25, 76], [944.75, 774, 270.25, 76]] },
  'rotations-16@1280x800': { vp: [1280, 800], r: [[348.25, 123, 269.25, 76], [646.5, 123, 269.25, 76], [944.75, 123, 270.25, 76], [348.25, 216, 269.25, 76], [646.5, 216, 269.25, 76], [944.75, 216, 270.25, 76], [348.25, 309, 269.25, 76], [646.5, 309, 269.25, 76], [944.75, 309, 270.25, 76], [348.25, 402, 269.25, 76], [646.5, 402, 269.25, 76], [944.75, 402, 270.25, 76], [348.25, 495, 269.25, 76], [646.5, 495, 269.25, 76], [944.75, 495, 270.25, 76], [348.25, 588, 269.25, 76], [646.5, 588, 269.25, 76], [944.75, 588, 270.25, 76], [348.25, 681, 269.25, 76], [646.5, 681, 269.25, 76], [944.75, 681, 270.25, 76], [348.25, 774, 269.25, 76], [646.5, 774, 269.25, 76], [944.75, 774, 270.25, 76], [348.25, 867, 269.25, 76], [646.5, 867, 269.25, 76], [944.75, 867, 270.25, 76], [348.25, 960, 269.25, 76], [646.5, 960, 269.25, 76], [944.75, 960, 270.25, 76], [348.25, 1053, 269.25, 76], [646.5, 1053, 269.25, 76], [944.75, 1053, 270.25, 76], [348.25, 1146, 269.25, 76], [646.5, 1146, 269.25, 76], [944.75, 1146, 270.25, 76], [348.25, 1239, 269.25, 76], [646.5, 1239, 269.25, 76], [944.75, 1239, 270.25, 76], [348.25, 1332, 269.25, 76], [646.5, 1332, 269.25, 76], [944.75, 1332, 270.25, 76], [348.25, 1425, 269.25, 76], [646.5, 1425, 269.25, 76], [944.75, 1425, 270.25, 76], [348.25, 1518, 269.25, 76], [646.5, 1518, 269.25, 76], [944.75, 1518, 270.25, 76]] },
  'rotations-5@960x680': { vp: [960, 680], r: [[272.25, 141, 181.25, 90], [490.5, 141, 181.25, 90], [708.75, 141, 182.25, 90], [272.25, 260, 181.25, 90], [490.5, 260, 181.25, 90], [708.75, 260, 182.25, 90], [272.25, 379, 181.25, 90], [490.5, 379, 181.25, 90], [708.75, 379, 182.25, 90], [272.25, 498, 181.25, 90], [490.5, 498, 181.25, 90], [708.75, 498, 182.25, 90], [272.25, 617, 181.25, 90], [490.5, 617, 181.25, 90], [708.75, 617, 182.25, 90]] },
  'rotations-4@1920x1080': { vp: [1920, 1080], r: [[512.25, 141, 421.25, 90], [970.5, 141, 421.25, 90], [1428.75, 141, 422.25, 90], [512.25, 260, 421.25, 90], [970.5, 260, 421.25, 90], [1428.75, 260, 422.25, 90], [512.25, 379, 421.25, 90], [970.5, 379, 421.25, 90], [1428.75, 379, 422.25, 90], [512.25, 498, 421.25, 90], [970.5, 498, 421.25, 90], [1428.75, 498, 422.25, 90]] },
  'picker-1@1280x800': { vp: [1280, 800], r: [[174.5, 212.25, 916, 380]] },
};
// Recorded in the review lab (viewport px): cover rects [left, top, width, height], their scroller view, and every label box near the footer.
const LABEL_LAYOUTS: Record<string, { vp: [number, number]; view: [number, number, number, number] | null; r: [number, number, number, number][]; labels: [number, number, number, number][] }> = {
  'today-8x8@1280x800': { vp: [1280,800], view: [36,68,1193,790], r: [[511.25,123,143.97,76],[684.22,123,143.97,76],[857.19,123,143.97,76],[1030.16,123,143.97,76],[1203.13,123,143.97,76],[1376.09,123,143.97,76],[1549.06,123,143.97,76],[1722.03,123,144.97,76],[511.25,216,143.97,76],[684.22,216,143.97,76],[857.19,216,143.97,76],[1030.16,216,143.97,76],[1203.13,216,143.97,76],[1376.09,216,143.97,76],[1549.06,216,143.97,76],[1722.03,216,144.97,76],[511.25,309,143.97,76],[684.22,309,143.97,76],[857.19,309,143.97,76],[1030.16,309,143.97,76],[1203.13,309,143.97,76],[1376.09,309,143.97,76],[1549.06,309,143.97,76],[1722.03,309,144.97,76],[511.25,402,143.97,76],[684.22,402,143.97,76],[857.19,402,143.97,76],[1030.16,402,143.97,76],[1203.13,402,143.97,76],[1376.09,402,143.97,76],[1549.06,402,143.97,76],[1722.03,402,144.97,76],[511.25,495,143.97,76],[684.22,495,143.97,76],[857.19,495,143.97,76],[1030.16,495,143.97,76],[1203.13,495,143.97,76],[1376.09,495,143.97,76],[1549.06,495,143.97,76],[1722.03,495,144.97,76],[511.25,588,143.97,76],[684.22,588,143.97,76],[857.19,588,143.97,76],[1030.16,588,143.97,76],[1203.13,588,143.97,76],[1376.09,588,143.97,76],[1549.06,588,143.97,76],[1722.03,588,144.97,76],[511.25,681,143.97,76],[684.22,681,143.97,76],[857.19,681,143.97,76],[1030.16,681,143.97,76],[1203.13,681,143.97,76],[1376.09,681,143.97,76],[1549.06,681,143.97,76],[1722.03,681,144.97,76],[511.25,774,143.97,76],[684.22,774,143.97,76],[857.19,774,143.97,76],[1030.16,774,143.97,76],[1203.13,774,143.97,76],[1376.09,774,143.97,76],[1549.06,774,143.97,76],[1722.03,774,144.97,76]], labels: [[57.83,518.25,34.33,29],[107,520.41,67.97,25],[511.25,517,38.45,32],[554.53,528,56.56,19],[684.22,517,38.45,32],[727.5,528,54.06,19],[857.19,517,38.45,32],[900.47,528,100.17,19],[1030.16,517,38.45,32],[1073.44,528,87.48,19],[1203.13,517,25.87,32],[57.83,611.25,34.33,29],[107,613.41,45.69,25],[511.25,610,38.45,32],[554.53,621,54.06,19],[684.22,610,38.45,32],[727.5,621,100.17,19],[857.19,610,38.45,32],[900.47,621,87.48,19],[1030.16,610,38.45,32],[1073.44,621,66.22,19],[1203.13,610,25.87,32],[57.83,704.25,34.33,29],[107,706.41,103.94,25],[511.25,703,38.45,32],[554.53,714,100.17,19],[684.22,703,38.45,32],[727.5,714,87.48,19],[857.19,703,38.45,32],[900.47,714,66.22,19],[1030.16,703,38.45,32],[1073.44,714,57.17,19],[1203.13,703,25.87,32],[55,513,40,40],[55,606,40,40],[55,699,40,40]] },
  'today-5x3@960x680': { vp: [960,680], view: [36,68,873,653], r: [[272.25,141,181.25,90],[490.5,141,181.25,90],[708.75,141,182.25,90],[272.25,260,181.25,90],[490.5,260,181.25,90],[708.75,260,182.25,90],[272.25,379,181.25,90],[490.5,379,181.25,90],[708.75,379,182.25,90],[272.25,498,181.25,90],[490.5,498,181.25,90],[708.75,498,182.25,90],[272.25,617,181.25,90],[490.5,617,181.25,90],[708.75,617,182.25,90]], labels: [[63.45,407.75,37.08,31],[117,412,100.14,23],[272.25,408,38.45,32],[315.53,419,66.22,19],[490.5,408,38.45,32],[533.78,419,57.17,19],[708.75,408,38.45,32],[752.03,419,56.56,19],[63.45,526.75,37.08,31],[117,531,44.25,23],[272.25,527,38.45,32],[315.53,538,57.17,19],[490.5,527,38.45,32],[533.78,538,56.56,19],[708.75,527,38.45,32],[752.03,538,54.06,19],[59,401,46,46],[59,520,46,46]] },
  'today-16x3@1280x800': { vp: [1280,800], view: [36,68,1193,1534], r: [[348.25,123,269.25,76],[646.5,123,269.25,76],[944.75,123,270.25,76],[348.25,216,269.25,76],[646.5,216,269.25,76],[944.75,216,270.25,76],[348.25,309,269.25,76],[646.5,309,269.25,76],[944.75,309,270.25,76],[348.25,402,269.25,76],[646.5,402,269.25,76],[944.75,402,270.25,76],[348.25,495,269.25,76],[646.5,495,269.25,76],[944.75,495,270.25,76],[348.25,588,269.25,76],[646.5,588,269.25,76],[944.75,588,270.25,76],[348.25,681,269.25,76],[646.5,681,269.25,76],[944.75,681,270.25,76],[348.25,774,269.25,76],[646.5,774,269.25,76],[944.75,774,270.25,76],[348.25,867,269.25,76],[646.5,867,269.25,76],[944.75,867,270.25,76],[348.25,960,269.25,76],[646.5,960,269.25,76],[944.75,960,270.25,76],[348.25,1053,269.25,76],[646.5,1053,269.25,76],[944.75,1053,270.25,76],[348.25,1146,269.25,76],[646.5,1146,269.25,76],[944.75,1146,270.25,76],[348.25,1239,269.25,76],[646.5,1239,269.25,76],[944.75,1239,270.25,76],[348.25,1332,269.25,76],[646.5,1332,269.25,76],[944.75,1332,270.25,76],[348.25,1425,269.25,76],[646.5,1425,269.25,76],[944.75,1425,270.25,76],[348.25,1518,269.25,76],[646.5,1518,269.25,76],[944.75,1518,270.25,76]], labels: [[57.83,518.25,34.33,29],[107,520.41,67.97,25],[348.25,517,38.45,32],[391.53,528,56.56,19],[646.5,517,38.45,32],[689.78,528,54.06,19],[944.75,517,38.45,32],[988.03,528,100.17,19],[57.83,611.25,34.33,29],[107,613.41,45.69,25],[348.25,610,38.45,32],[391.53,621,54.06,19],[646.5,610,38.45,32],[689.78,621,100.17,19],[944.75,610,38.45,32],[988.03,621,87.48,19],[57.83,704.25,34.33,29],[107,706.41,103.94,25],[348.25,703,38.45,32],[391.53,714,100.17,19],[646.5,703,38.45,32],[689.78,714,87.48,19],[944.75,703,38.45,32],[988.03,714,66.22,19],[55,513,40,40],[55,606,40,40],[55,699,40,40]] },
  'today-6x4@960x680': { vp: [960,680], view: [36,68,873,772], r: [[310.25,141,155.19,90],[502.44,141,155.19,90],[694.63,141,155.19,90],[886.81,141,156.19,90],[310.25,260,155.19,90],[502.44,260,155.19,90],[694.63,260,155.19,90],[886.81,260,156.19,90],[310.25,379,155.19,90],[502.44,379,155.19,90],[694.63,379,155.19,90],[886.81,379,156.19,90],[310.25,498,155.19,90],[502.44,498,155.19,90],[694.63,498,155.19,90],[886.81,498,156.19,90],[310.25,617,155.19,90],[502.44,617,155.19,90],[694.63,617,155.19,90],[886.81,617,156.19,90],[310.25,736,155.19,90],[502.44,736,155.19,90],[694.63,736,155.19,90],[886.81,736,156.19,90]], labels: [[63.45,407.75,37.08,31],[117,412,100.14,23],[310.25,408,38.45,32],[353.53,419,66.22,19],[502.44,408,38.45,32],[545.72,419,57.17,19],[694.63,408,38.45,32],[737.91,419,56.56,19],[886.81,408,22.19,32],[63.45,526.75,37.08,31],[117,531,44.25,23],[310.25,527,38.45,32],[353.53,538,57.17,19],[502.44,527,38.45,32],[545.72,538,56.56,19],[694.63,527,38.45,32],[737.91,538,54.06,19],[886.81,527,22.19,32],[59,401,46,46],[59,520,46,46]] },
  'groups-12@1280x800': { vp: [1280,800], view: [0,0,1265,800], r: [[24,74,289.25,231.06],[333.25,74,289.25,231.06],[642.5,74,289.25,231.06],[951.75,74,289.25,231.06],[24,325.06,289.25,231.06],[333.25,325.06,289.25,231.06],[642.5,325.06,289.25,231.06],[951.75,325.06,289.25,231.06],[24,576.13,289.25,231.06],[333.25,576.13,289.25,231.06],[642.5,576.13,289.25,231.06],[951.75,576.13,289.25,231.06]], labels: [[50,470.59,64.58,30],[359.25,470.59,82.69,30],[359.25,509.86,48.73,30],[668.5,470.59,43.36,30],[977.75,470.59,43.55,30],[977.75,509.86,37.08,30],[37.2,591.13,31.59,27],[80,594.45,46.92,21],[50,643.13,37.08,30],[50,682.39,55.36,30],[50,721.66,29.75,30],[346.45,591.13,31.59,27],[389.25,594.45,76.42,21],[359.25,643.13,42.89,30],[359.25,682.39,47.94,30],[359.25,721.66,40.36,30],[655.7,591.13,31.59,27],[698.5,594.45,67.63,21],[668.5,643.13,64.58,30],[668.5,682.39,34.3,30],[668.5,721.66,68.56,30],[964.95,591.13,31.59,27],[1007.75,594.45,74.22,21],[977.75,643.13,82.69,30],[977.75,682.39,48.73,30],[977.75,721.66,60.02,30],[36,588.13,34,34],[345.25,588.13,34,34],[654.5,588.13,34,34],[963.75,588.13,34,34]] },
  'groups-12@960x680': { vp: [960,680], view: [0,0,945,680], r: [[24,74,285.66,217.56],[329.66,74,285.67,217.56],[635.33,74,285.66,217.56],[24,311.56,285.66,217.56],[329.66,311.56,285.67,217.56],[635.33,311.56,285.66,217.56],[24,549.13,285.66,217.56],[329.66,549.13,285.67,217.56],[635.33,549.13,285.66,217.56],[24,786.69,285.66,217.56],[329.66,786.69,285.67,217.56],[635.33,786.69,285.66,217.56]], labels: [[50,378.56,49.73,27],[50,414.45,26.73,27],[50,450.34,38.55,27],[50,486.23,43.08,27],[355.66,378.56,43.08,27],[355.66,414.45,36.27,27],[355.66,450.34,58.03,27],[661.33,378.56,30.81,27],[661.33,414.45,61.61,27],[661.33,450.34,74.28,27],[661.33,486.23,43.78,27],[37.2,564.13,31.59,27],[80,567.34,84.14,20],[342.86,564.13,31.59,27],[385.66,567.34,52,20],[648.53,564.13,31.59,27],[691.33,567.34,42.98,20],[36,323.56,34,34],[341.66,323.56,34,34],[647.33,323.56,34,34],[36,561.13,34,34],[341.66,561.13,34,34],[647.33,561.13,34,34]] },
};
const layouts = Object.entries(LAYOUTS).map(([name, { vp, r }]) => ({
  name, viewport: { width: vp[0], height: vp[1] }, rects: r.map(([left, top, width, height]): Rect => ({ left, top, width, height })),
}));

void test('squishy bounce: the beat sheet is ordered and every card is revealed well before the end', () => {
  assert.equal(LANDINGS.length, 6);
  assert.equal(LANDINGS[0], .95);
  LANDINGS.forEach((land, k) => { if (k) assert.ok(Math.abs(land - LANDINGS[k - 1] - HOP) < EPS, 'landings are one musical hop apart'); });
  assert.ok(Math.abs(TAKEOFF - (LANDINGS[5] + DEEP_SINK)) < EPS);
  const beats = [TAKEOFF, APEX, UH_OH, DROP, SPLAT, TOSS, FLOOR, INFLATE, UNFLAT, RELIEVED, ROUND, WINK, WINK_END, DUCK, GONE];
  beats.forEach((beat, k) => { if (k) assert.ok(beat > beats[k - 1], `beat ${k} follows beat ${k - 1}`); });
  assert.ok(GONE <= 7.2 && GONE < DURATION, 'the stage is empty before the reveal ends');
  assert.ok(DROP - UH_OH >= .4, 'the uh-oh hang is long enough to read');
  assert.ok(Math.abs(COVERS_GONE - (SPLAT + SPLAT_SPREAD + HOLD + FLY)) < EPS && COVERS_GONE <= 5.7, 'every pillow has flown away by 5.7 s');
  assert.ok(Math.abs(REVEALED_BY - (SPLAT + SPLAT_SPREAD + BED_POOF_DELAY + BED_POOF)) < EPS && REVEALED_BY <= COVERS_GONE, 'every card is visible by 5.40 s');
  assert.ok(SAFETY_FADE_AT + SAFETY_FADE <= DURATION, 'an unplanned cover still vanishes before the end');
  assert.ok(Z_START + 2 * Z_STAGGER + Z_LAG + Z_DURATION <= LANDINGS[0], 'the sleepy z puffs are gone before the first landing');
  assert.ok(BREATH > .5, 'sleepy breathing is slow');
  assert.ok(DIZZY > SPLAT && DIZZY < TOSS);
  assert.ok(TOSS_UP > 0 && TOSS + TOSS_UP < FLOOR, 'the toss pops, then tumbles to the footer');
  assert.ok(valueAt(BUDDY_SPIN, TOSS + FLIP_DELAY).includes('rotate(0deg)') && FLIP_DELAY > 0 && TOSS + FLIP_DELAY < FLOOR - .3, 'the flip waits a beat, until the rising face is above the pancake');
  assert.ok(UNFLAT - INFLATE <= .05, 'the pre-stretched pancake face leaves as soon as the buddy starts to puff back up');
  assert.ok(IMPACT <= .15 + EPS && IMPACT >= SINK, 'impact strokes ride the whole sink and are gone by L + 0.15');
  assert.equal(SQUISHY_DURATION_MS, 7300);
  assert.ok(SQUISHY_DURATION_MS <= 9800);
});

void test('squishy bounce: the effect export matches the timeline', () => {
  assert.equal(squishyBounceEffect.id, 'squishy-bounce');
  assert.equal(squishyBounceEffect.name, 'Squishy bounce');
  assert.equal(squishyBounceEffect.durationMs, SQUISHY_DURATION_MS);
  assert.equal(squishyBounceEffect.sound, 'squishy-bounce');
  assert.equal(typeof squishyBounceEffect.Stage, 'function');
  assert.equal(typeof squishyBounceEffect.Cover, 'function');
  for (const kind of ['sleepy', 'squish', 'awake', 'squashed', 'wide', 'joy']) assert.ok(SQUISHY_COVER_HTML.includes(`is-${kind}`), `cover has the ${kind} face`);
  for (const part of ['sq-bed', 'sq-splat', 'sq-hits', 'sq-breathe', 'sq-pillow', 'sq-face-hits', 'sq-face-splat']) assert.ok(SQUISHY_COVER_HTML.includes(`"${part}"`) || SQUISHY_COVER_HTML.includes(`${part}"`), part);
  assert.equal((SQUISHY_COVER_HTML.match(/<div/g) ?? []).length, (SQUISHY_COVER_HTML.match(/<\/div>/g) ?? []).length, 'cover markup is balanced');
});

void test('squishy bounce: the committed stylesheet carries the generated choreography', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const expected = withGeneratedBlock(css);
  if (expected !== css && process.env.SQUISHY_WRITE_CSS === '1') writeFileSync(CSS_PATH, expected);
  assert.ok(css.includes(GENERATED_BEGIN) && css.includes(GENERATED_END), 'generated block markers are present');
  assert.equal(css, expected, `${CSS_PATH} is stale: rerun this test with SQUISHY_WRITE_CSS=1 to regenerate it from squishyKeyframesCss()`);
});

void test('squishy bounce: generated keyframes are well formed and fit their durations', () => {
  const css = squishyKeyframesCss();
  const blocks = [...css.matchAll(/@keyframes ([\w-]+)\{(.*?)\}\}/g)];
  assert.equal(blocks.length, (css.match(/@keyframes/g) ?? []).length, 'every @keyframes block parses');
  assert.ok(blocks.length >= 25);
  for (const [, name, body] of blocks) {
    const offsets = [...`${body}}`.matchAll(/(?:^|\})([\d.]+)%\{/g)].map((match) => Number(match[1]));
    assert.equal(offsets[0], 0, `${name} starts at 0%`);
    assert.equal(offsets.at(-1), 100, `${name} ends at 100%`);
    offsets.forEach((offset, k) => { if (k) assert.ok(offset >= offsets[k - 1], `${name} offsets never go back in time`); });
  }
  assert.ok(!/@property|offset-path|view-transition/.test(css), 'no Safari-hostile features');
  assert.ok(!/scale\([^)]*calc\(/.test(css), 'no calc() inside scale()');
  // Every variable the keyframes read is written by the planner (or statically by the stylesheet).
  const plan = planSquishyBounce(layouts[1].rects, layouts[1].viewport);
  const written = new Set([...Object.keys(plan.stageVars), ...Object.keys(plan.covers[0].vars)]);
  for (const [, name] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(written.has(name), `${name} is planned`);
});

void test('squishy bounce: buddy tracks start hidden, touch down on every landing and end hidden', () => {
  for (const [name, track] of Object.entries({ BUDDY_X, BUDDY_Y, BUDDY_BODY, BUDDY_SPIN, SHADOW, SHADOW_Y })) {
    const t = times(track);
    assert.equal(t[0], 0, `${name} starts at 0`);
    assert.ok(Math.abs(t.at(-1)! - DURATION) < EPS, `${name} ends at the duration`);
    t.forEach((time, k) => { if (k) assert.ok(time >= t[k - 1], `${name} is monotonic at ${time}`); });
  }
  assert.ok(BUDDY_Y[0][1].includes('yhide') && BUDDY_Y.at(-1)![1].includes('yduck'), 'peeks from and ducks behind the footer');
  LANDINGS.forEach((land, k) => {
    assert.ok(valueAt(BUDDY_Y, land).some((value) => value === `translateY(var(--sqb-yl${k + 1}))`), `feet on the touchdown rim at L${k + 1}`);
    assert.ok(valueAt(SHADOW_Y, land).some((value) => value === `translateY(var(--sqb-yl${k + 1}))`), `shadow on the touchdown rim at L${k + 1}`);
    assert.ok(valueAt(BUDDY_X, land).some((value) => value.includes(`--sqb-x${k + 1})`)), `x${k + 1} at L${k + 1}`);
    if (k < 5) assert.ok(valueAt(BUDDY_X, land + SINK).some((value) => value.includes(`--sqb-x${k + 1})`)), `x holds while the pillow sinks at L${k + 1}`);
  });
  // Feet ride each dip with the pillow's own easing, then (last landing) its rebound until the super jump.
  LANDINGS.forEach((land, k) => {
    assert.equal(BUDDY_Y.find(([time]) => Math.abs(time - land) < EPS)![2], HIT_SQUASH_EASE, `L${k + 1} sinks with the pillow's easing`);
    assert.ok(valueAt(BUDDY_Y, land + SINK).some((value) => value === `translateY(var(--sqb-ys${k + 1}))`), `L${k + 1} bottoms out with the pillow`);
  });
  assert.equal(hitKeys(1)[0][2], HIT_SQUASH_EASE);
  assert.ok(valueAt(BUDDY_Y, TAKEOFF).some((value) => value.includes('--sqb-ys6to')) && BUDDY_Y.find(([time]) => Math.abs(time - (LANDINGS[5] + SINK)) < EPS)![2] === HIT_RISE_EASE);
  assert.ok(DEEP_REBOUND > 0 && DEEP_REBOUND < RECOVER.g);
  assert.ok(Math.abs(easeAt('io', .5) - .5) < 1e-6 && easeAt('snap', 0) === 0 && Math.abs(easeAt('soft', 1) - 1) < 1e-9 && easeAt('snap', .5) > easeAt('soft', .5));
  for (const { name, rects, viewport } of layouts) {
    const plan = planSquishyBounce(rects, viewport);
    assert.ok(Math.abs(parseFloat(plan.stageVars['--sqb-ys6to']) - (plan.yLand + plan.landings[5].sink * (1 - DEEP_REBOUND))) < .1, `${name}: ys6to`);
  }
  assert.ok(valueAt(BUDDY_Y, SPLAT).some((value) => value.includes('--sqb-yland')), 'the belly-flop meets the landing line');
  // No squash against thin air: the body holds its falling stretch (a step) until the frame the feet touch, then squashes.
  for (const contact of [...LANDINGS, SPLAT, FLOOR]) {
    const before = BUDDY_BODY.filter(([time]) => time < contact - EPS).at(-1)!;
    assert.equal(before[2], 'step', `the body holds its pose until the contact at ${contact}`);
    assert.ok(contact - before[0] <= .05 && BUDDY_BODY.some(([time]) => Math.abs(time - contact) < EPS), `a squash key sits exactly on the contact at ${contact}`);
  }
  assert.ok(valueAt(BUDDY_Y, FLOOR).some((value) => value.includes('--sqb-yfloor')), 'the pancake plops onto the footer edge');
  assert.ok(BUDDY_BODY.some(([time, value]) => time > SPLAT && time < TOSS && value === `scale(${PANCAKE[0]},${PANCAKE[1]})`), 'pancake shape held during the splat');
  assert.ok(BUDDY_SPIN.some(([time, value]) => time <= FLOOR && value === FLIP), 'the pancake flip completes before the plop');
  assert.ok(valueAt(SHADOW, SPLAT).some((value) => value.endsWith('opacity:0')), 'the contact shadow is gone the instant the belly-flop lands');
  assert.ok(SHADOW.filter(([time]) => time >= SPLAT).every(([, value]) => value.endsWith('opacity:0')), 'no shadow is left on the landing line after the splat');
});

void test('squishy bounce: the belly-flop rides the centre pillow through the whole splat hold', () => {
  // Same key times and easings as every pillow's splat track.
  assert.deepEqual(SPLAT_KEYS.slice(1, 1 + SPLAT_HOLD.length).map(([time]) => time), SPLAT_HOLD.map(([time]) => time));
  assert.equal(SPLAT_KEYS[0][2], SPLAT_SQUASH_EASE);
  assert.equal(valueAt(BUDDY_Y, SPLAT).length, 1);
  assert.equal(BUDDY_Y.find(([time]) => Math.abs(time - SPLAT) < EPS)![2], SPLAT_SQUASH_EASE, 'the pancake sinks with the same snap as the pillow');
  SPLAT_HOLD.forEach(([time, key], k) => {
    const buddy = BUDDY_Y.find(([t]) => Math.abs(t - (SPLAT + time)) < EPS);
    assert.ok(buddy && buddy[1] === `translateY(var(--sqb-${holdVar(key)}))`, `buddy key at SPLAT + ${time} (${key})`);
    if (time < HOLD) {
      assert.equal(buddy[2], SPLAT_HOLD_EASE);
      assert.equal(SPLAT_KEYS[k + 1][2], SPLAT_HOLD_EASE);
    }
  });
  assert.ok(!BUDDY_Y.some(([time]) => time > SPLAT && time < TOSS && !SPLAT_HOLD.some(([t]) => Math.abs(SPLAT + t - time) < EPS)), 'no other key breaks the ride');
  for (const { name, rects, viewport } of layouts) {
    const plan = planSquishyBounce(rects, viewport);
    const centre = plan.covers[plan.centre];
    assert.equal(centre.splatAt, SPLAT, `${name}: the ridden pillow squashes exactly at SPLAT`);
    // Every hop-row pillow under the pancake's footprint squashes with it, so the pancake lies flat on both rims of an even row.
    const half = PANCAKE_HIT[0] * plan.size / 2;
    const under = plan.hopRow.filter((index) => rects[index].left < plan.xMid + half && rects[index].left + rects[index].width > plan.xMid - half);
    assert.ok(under.includes(plan.centre));
    for (const index of under) {
      assert.equal(plan.covers[index].splatAt, SPLAT, `${name}: pillow ${index} under the pancake squashes at SPLAT`);
      assert.equal(plan.covers[index].vars['--sq-ssy'], centre.vars['--sq-ssy'], `${name}: pillow ${index} flattens to the ridden rim`);
    }
    if (plan.hopRow.length % 2 === 0 && plan.hopRow.length > 1) assert.ok(under.length >= 2, `${name}: an even row puts the pancake on two pillows`);
    assert.ok(Math.abs(plan.centreBottom - rects[plan.centre].top - centre.pillowBottom) < EPS);
    for (const [, key] of SPLAT_HOLD) {
      // The pillow's rendered scale for this key (the variable it animates to), squashed about its bottom edge.
      const scaleY = Number(centre.vars[`--sq-${key}y`]);
      const rim = plan.centreBottom - plan.centreSpan * scaleY;
      const buddy = parseFloat(plan.stageVars[`--sqb-${holdVar(key)}`]);
      assert.ok(Math.abs(buddy - rim) < 1, `${name}: at ${key} the buddy's feet (${buddy}) are on the rim (${rim.toFixed(1)})`);
    }
    assert.ok(Math.abs(parseFloat(plan.stageVars['--sqb-ysj']) - parseFloat(plan.stageVars['--sqb-ysplat']) + SPLAT_TREMBLE.j[1] * plan.centreSpan) < 1, `${name}: the jiggle lifts the pancake with the rim`);
  }
});

void test('squishy bounce: exactly one buddy face is visible at every moment', () => {
  const all = (Object.entries(BUDDY_FACES) as [BuddyFace, readonly (readonly [number, number])[]][]).flatMap(([face, spans]) => spans.map(([start, end]) => ({ face, start, end })));
  all.sort((a, b) => a.start - b.start);
  assert.equal(all[0].start, 0);
  all.forEach((span, k) => {
    assert.ok(span.end > span.start, `${span.face} span is not empty`);
    if (k) assert.ok(Math.abs(span.start - all[k - 1].end) < EPS, `${all[k - 1].face} hands over to ${span.face} without a gap or overlap`);
  });
  assert.ok(Math.abs(all.at(-1)!.end - DURATION) < EPS);
  for (let ms = 0; ms <= SQUISHY_DURATION_MS; ms += 5) assert.ok(faceAt(ms / 1000), `a face at ${ms} ms`);
  // The eyes squeeze shut a frame before every touchdown, so the contact frame always shows the landing face.
  LANDINGS.forEach((land, k) => {
    const face = k < 5 ? 'squint' : 'ready';
    assert.equal(faceAt(land), face, `L${k + 1} touches down with the ${face} face`);
    assert.equal(faceAt(land - FACE_LEAD), face, `L${k + 1}: the ${face} face leads the touchdown`);
    assert.equal(faceAt(land - FACE_LEAD - .001), 'whee', `L${k + 1}: whee until just before the touchdown`);
  });
  assert.ok(FACE_LEAD > 0 && FACE_LEAD <= .03, 'the lead is about one frame');
  assert.ok(BUDDY_FACES.uhoh.reduce((sum, [start, end]) => sum + end - start, 0) >= .4, 'the uh-oh face holds long enough to read');
  for (const [name, spans] of Object.entries(BUDDY_EXTRAS)) for (const [start, end] of spans) assert.ok(start < end && start >= 0 && end <= DURATION, name);
});

void test('squishy bounce: the sound beats avoid the silent hang and hold', () => {
  const beats = Object.values(SOUND_BEATS).flatMap((value) => typeof value === 'number' ? [value] : [...value]);
  for (const beat of beats) for (const [start, end] of SILENT_WINDOWS) assert.ok(beat < start || beat >= end, `beat ${beat} is outside the silence ${start}-${end}`);
  assert.ok(SILENT_WINDOWS[0][0] >= UH_OH - .02 && SILENT_WINDOWS[0][1] <= DROP, 'the uh-oh silence sits inside the hang');
  assert.ok(SILENT_WINDOWS[1][0] >= SPLAT + SPLAT_SPREAD && SILENT_WINDOWS[1][1] <= TOSS, 'the charged hold is silent before the BOING');
});

void test('squishy bounce: six landings spread over 1 to 7 columns', () => {
  const expected: Record<number, number[]> = { 1: [0, 0, 0, 0, 0, 0], 2: [0, 0, 0, 1, 1, 1], 3: [0, 0, 1, 1, 2, 2], 4: [0, 1, 1, 2, 2, 3], 5: [0, 1, 2, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  for (const [columns, pattern] of Object.entries(expected)) assert.deepEqual(landingColumns(Number(columns)), pattern, `${columns} columns`);
  for (let columns = 1; columns <= 12; columns++) {
    const pattern = landingColumns(columns);
    pattern.forEach((column, k) => { assert.ok(column >= 0 && column < columns); if (k) assert.ok(column >= pattern[k - 1], 'the buddy never hops backwards'); });
    if (columns <= 6) assert.equal(new Set(pattern).size, columns, `every one of ${columns} columns is visited`);
  }
  assert.deepEqual(landingColumns(7), [0, 1, 2, 4, 5, 6], 'seven columns skip only the middle one');
  for (const m of [1, 2, 3, 6]) for (let j = 0; j < m; j++) {
    const fraction = landingFraction(j, m);
    assert.ok(fraction >= .1 && fraction <= .9, 'landing spots stay well inside the card');
    if (j) assert.ok(fraction > landingFraction(j - 1, m));
  }
});

void test('squishy bounce: pillow hit patterns squash on the beat and rest at identity', () => {
  for (const m of HIT_PATTERNS) {
    const keys = hitKeys(m);
    const duration = hitDuration(m);
    assert.ok(Math.abs(duration - (.4 * (m - 1) + .9)) < EPS);
    assert.equal(keys[0][1], 'scale(1,1) rotate(0deg)');
    assert.equal(keys.at(-1)![1], 'scale(1,1) rotate(0deg)');
    assert.ok(Math.abs(keys.at(-1)![0] - duration) < EPS);
    const squashes = keys.filter(([, value]) => value.startsWith('scale(var(--sq-sx)')).map(([time]) => time);
    assert.deepEqual(squashes.map((time) => Math.round(time * 1000)), Array.from({ length: m }, (_, j) => Math.round((HOP * j + SINK) * 1000)), `pattern ${m} squashes at 0.4j + 0.1`);
    times(keys).forEach((time, k, all) => { if (k) assert.ok(time >= all[k - 1] && time <= duration + EPS); });
    const faces = faceHitKeys(m);
    for (let j = 0; j < m; j++) {
      assert.ok(faces.some(([time, value]) => Math.abs(time - (HOP * j + .001)) < EPS && value === 'translateY(-100%)'), 'scrunches on each hit');
      assert.ok(faces.some(([time, value]) => Math.abs(time - (HOP * j + .24)) < EPS && value === 'translateY(-200%)'), 'wakes up after each hit');
    }
  }
  assert.ok(SPLAT_KEYS[0][1].startsWith('translate(0px,0px) rotate(0deg) scale(1,1)'));
  assert.ok(SPLAT_KEYS.at(-1)![1].includes('opacity:0') && Math.abs(SPLAT_KEYS.at(-1)![0] - SPLAT_DURATION) < EPS, 'each pillow is gone at the end of its splat');
  assert.ok(SPLAT_KEYS.some(([time, value]) => Math.abs(time - (HOLD + .08)) < EPS && value.includes(`scale(${BOING_STRETCH[0]},${BOING_STRETCH[1]})`)), 'BOING stretch right after the hold');
  assert.deepEqual(FACE_SPLAT_KEYS.map(([, value]) => value), ['translateY(0%)', 'translateY(-100%)', 'translateY(-200%)', 'translateY(-300%)', 'translateY(-300%)']);
});

void test('squishy bounce: the planner is deterministic and never uses randomness', () => {
  const random = Math.random;
  Math.random = () => { throw new Error('the planner must be deterministic'); };
  try {
    for (const { name, rects, viewport } of layouts) assert.equal(JSON.stringify(planSquishyBounce(rects, viewport)), JSON.stringify(planSquishyBounce(rects, viewport)), name);
  } finally { Math.random = random; }
  const empty = planSquishyBounce([], { width: 1280, height: 800 });
  assert.equal(empty.landings.length, 6);
  assert.ok(empty.landings.every(({ x }) => x > 0 && x < 1280));
  assert.equal(empty.covers.length, 0);
});

void test('squishy bounce: planned layouts keep the buddy visible, on the pillows and on the beat', () => {
  for (const { name, rects, viewport } of layouts) {
    const plan = planSquishyBounce(rects, viewport);
    const { width: vw, height: vh } = viewport;
    const at = (label: string) => `${name}: ${label}`;
    // Headroom: the header (z above the stage) hides the top ~66 px; the footer the bottom 64.
    assert.ok(plan.yApex - plan.size >= HEADER_SAFE, at('the head clears the header at the super-jump apex'));
    assert.ok(plan.yLand - plan.hopEffective - plan.size >= HEADER_SAFE, at('regular hops clear the header'));
    assert.ok(plan.yLand <= vh * .62 + EPS && plan.yLand >= plan.yApex, at('the landing line sits in the upper-middle band'));
    assert.equal(plan.yFloor, vh - FOOTER_HEIGHT);
    for (const [key, value] of Object.entries(plan.stageVars)) assert.ok(key === '--sqb-flip' ? /^-?360deg$/.test(value) : /^-?\d+(\.\d+)?px$/.test(value), at(`${key} is a finite value (${value})`));
    // The hop row is a real row, wide enough.
    const hop = plan.hopRow.map((index) => rects[index]);
    const seen = rects.filter((r) => shownFraction(r, viewport) >= .5);
    const widest = Math.max(...rowTops(seen).map((top) => seen.filter((r) => Math.abs(r.top - top) < 4).length));
    assert.ok(hop.length >= Math.ceil(widest * .6), at('the hop row holds at least 60% of the widest row'));
    // Landings: left to right, well inside their cards; every column visited up to six.
    plan.landings.forEach((landing, k) => {
      const card = hop[landing.column];
      assert.ok(landing.x >= card.left + card.width * .1 - EPS && landing.x <= card.left + card.width * .9 + EPS, at(`landing ${k + 1} inside its card`));
      if (k) assert.ok(landing.x > plan.landings[k - 1].x, at(`landing ${k + 1} is right of landing ${k}`));
      const cover = plan.covers[plan.hopRow[landing.column]];
      assert.ok(Math.abs(landing.sink - (card.top + cover.pillowBottom - plan.yLand) * (1 - cover.sy)) < .5, at(`the buddy rides pillow ${landing.column} down exactly`));
      assert.ok(Math.abs(card.top + cover.pillowTop + RIM_SINK - plan.yLand) < .5, at(`pillow ${landing.column}'s resting rim is the landing line`));
      // The rim as rendered at the touchdown and at the bottom of the sink (the pillow squashes about its bottom edge; later hits catch it still part-way down).
      const bottom = card.top + cover.pillowBottom;
      const span = bottom - plan.yLand;
      const keys = hitKeys(cover.hits);
      const land = LANDINGS[k];
      const touch = bottom - span * scaleYAt(keys, cover.vars, land - cover.hitAt);
      assert.ok(Math.abs(parseFloat(plan.stageVars[`--sqb-yl${k + 1}`]) - touch) < 1, at(`L${k + 1}: feet touch down on the rendered rim (${plan.stageVars[`--sqb-yl${k + 1}`]} vs ${touch.toFixed(1)})`));
      const sunk = bottom - span * scaleYAt(keys, cover.vars, land + SINK - cover.hitAt);
      assert.ok(Math.abs(parseFloat(plan.stageVars[`--sqb-ys${k + 1}`]) - sunk) < 1, at(`L${k + 1}: feet ride the rim to the bottom of the sink`));
      assert.ok(Math.abs(parseFloat(plan.stageVars[`--sqb-yl${k + 1}`]) + parseFloat(plan.stageVars[`--sqb-d${k + 1}`]) - sunk) < 1, at(`L${k + 1}: impact strokes start on the touchdown rim and ride it down`));
      assert.equal(landing.y === plan.yLand, !plan.landings.slice(0, k).some((other) => other.column === landing.column), at(`L${k + 1}: only a pillow's first hit lands on the resting rim`));
    });
    if (hop.length <= 6) hop.forEach((_, column) => assert.ok(plan.landings.some((landing) => landing.column === column), at(`column ${column} gets a hit`)));
    plan.covers.forEach((cover, index) => {
      const r = rects[index];
      const card = at(`card ${index}`);
      assert.ok(cover.hitAt >= LANDINGS[0] - EPS && cover.hitAt <= LANDINGS[5] + HIT_ECHO_CAP + EPS, `${card} hit window`);
      assert.ok(cover.splatAt >= SPLAT - EPS && cover.splatAt <= SPLAT + SPLAT_SPREAD + EPS, `${card} splat window`);
      assert.ok(cover.splatAt + HOLD + FLY <= COVERS_GONE + 1e-6 && cover.splatAt + BED_POOF_DELAY + BED_POOF <= REVEALED_BY + 1e-6, `${card} is revealed on time`);
      assert.ok(cover.hitAt + hitDuration(cover.hits) <= SPLAT + .9, `${card} has mostly risen before the splat`);
      assert.ok(cover.sy >= .55 - EPS && cover.sy < 1, `${card} hop squash in range (${cover.sy})`);
      assert.ok(cover.ssy >= .36 - EPS && cover.ssy <= .6, `${card} splat squash in range (${cover.ssy})`);
      assert.ok((cover.pillowBottom - cover.pillowTop) * cover.ssy >= SPLAT_MIN_PX - EPS || Math.abs(cover.ssy - SPLAT_MAX_Y) < EPS, `${card} a splatted cushion keeps ${SPLAT_MIN_PX} px`);
      assert.ok((cover.sx - 1) * r.width <= 60 + 1e-6 && (cover.ssx - 1) * r.width <= 70 + 1e-6, `${card} sideways bulge stays near its bed`);
      assert.ok(cover.fly <= -(r.top + r.height), `${card} flies fully past the top`);
      assert.ok(cover.faceY - cover.face / 4 >= cover.pillowTop && cover.faceY + cover.face / 4 <= cover.pillowBottom, `${card} face sits inside its pillow`);
      assert.ok(Math.abs(cover.pillowBottom - r.height * (1 - PILLOW_INSET_BOTTOM)) < EPS && cover.pillowTop >= r.height * PILLOW_INSET_TOP - EPS, `${card} pillow rests on its bed`);
      assert.ok(cover.pillowBottom - cover.pillowTop >= r.height * MIN_PILLOW - EPS, `${card} a lowered pillow stays plump`);
      assert.equal(cover.lowered, cover.pillowTop > r.height * PILLOW_INSET_TOP + .5, `${card} headboard flag`);
      assert.ok(cover.face <= plan.size * 1.6 + 1, `${card} face never upstages the buddy`);
      assert.ok(cover.face <= r.width * .6 && cover.face >= 32, `${card} face size`);
      // Sleepy breathing: an even number of half-breaths that ends on the rest pose exactly as this pillow is first hit.
      const breaths = Number(cover.vars['--sq-breaths']);
      assert.ok(breaths >= 2 && breaths % 2 === 0, `${card} breathes whole breaths`);
      assert.ok(Math.abs(parseFloat(cover.vars['--sq-breathe-at']) / 1000 + breaths * BREATH - cover.hitAt) < .002, `${card} breathing settles exactly at its first hit`);
      assert.ok(parseFloat(cover.vars['--sq-breathe-at']) <= 0, `${card} is already mid-breath when the reveal starts`);
      // Popcorn: short cells scatter (drift and spin in a checkerboard), tall cards keep their small wobble.
      if (r.height < POPCORN_HEIGHT * plan.size) {
        assert.ok(Math.abs(cover.drift) >= .2 * r.width - EPS && Math.abs(cover.drift) <= .45 * r.width + EPS, `${card} popcorn drift`);
        assert.ok(Math.abs(cover.spin) >= 8 - EPS && Math.abs(cover.spin) <= 20 + EPS, `${card} popcorn spin`);
        assert.ok(Math.sign(cover.drift) === Math.sign(cover.spin) && parseFloat(cover.vars['--sq-drift0']) * cover.drift > 0, `${card} kicks sideways at the BOING`);
      } else assert.ok(Math.abs(cover.drift) <= 30 && parseFloat(cover.vars['--sq-drift0']) === 0 && cover.vars['--sq-spin0'] === '0deg', `${card} tall cards keep their straight launch`);
    });
    // Popcorn neighbours (same column, next row; same row, next column) leave in opposite directions.
    rects.forEach((a, i) => rects.forEach((b, j) => {
      if (j <= i || a.height >= POPCORN_HEIGHT * plan.size || b.height >= POPCORN_HEIGHT * plan.size) return;
      const sameRow = Math.abs(a.top - b.top) < 4 && Math.abs(a.left + a.width - b.left) < 40;
      const sameColumn = Math.abs(a.left - b.left) < 4 && Math.abs(a.top + a.height - b.top) < 40;
      if (sameRow || sameColumn) assert.notEqual(Math.sign(plan.covers[i].drift), Math.sign(plan.covers[j].drift), at(`popcorn cells ${i} and ${j} scatter apart`));
    }));
    // Cards right under the belly-flop squash first.
    const nearest = plan.covers.filter((_, index) => {
      const r = rects[index];
      const d = Math.hypot(Math.max(r.left - plan.xMid, 0, plan.xMid - r.left - r.width), 1.2 * Math.max(r.top - plan.ySplat, 0, plan.ySplat - r.top - r.height));
      return d <= plan.ring * .1;
    });
    assert.ok(nearest.length > 0 && nearest.every((cover) => cover.splatAt <= SPLAT + .03), at('the squash wave starts under the pancake'));
    // The splat lands on the centre pillow's squashed rim, below the landing line and inside that card.
    assert.ok(plan.ySplat > plan.yLand && plan.ySplat < plan.yFloor, at('the pancake sinks with the centre pillow'));
    // After the plop (no labels recorded here): a short sideways toss, a little lower only when a card row runs under the footer.
    const under = rects.some((r) => r.top < plan.yFloor - 4 && r.top + r.height > plan.yFloor + 4);
    assert.equal(plan.rest.pose, 'rest');
    assert.ok(Math.abs(plan.yRest - plan.yFloor - (under ? plan.size * FLOOR_TUCK : 0)) < EPS, at('floor pose'));
    assert.ok(Math.abs(Math.abs(plan.xRest - plan.xMid) - TOSS_SIDE * plan.size) < 1 || plan.xRest <= plan.size * .6 + 12 + EPS || plan.xRest >= vw - plan.size * .6 - 12 - EPS, at('the toss lands just beside the splat'));
    assert.equal(plan.stageVars['--sqb-flip'], plan.xRest < plan.xMid ? '-360deg' : '360deg', at('the flip turns the way it travels'));
    const yToss = parseFloat(plan.stageVars['--sqb-ytoss']);
    const pancake = plan.size * PANCAKE[1] * 1.1;
    assert.ok(yToss >= parseFloat(plan.stageVars['--sqb-yst5']) - plan.size * TOSS_POP - .1, at('the toss is at most a small pop off the rim'));
    assert.ok(yToss - pancake >= plan.faceUp + 6 - .1 || Math.abs(yToss - (plan.yFloor - pancake)) < .1, at(`the tossed pancake stays below the BOINGed pillow's face (${yToss.toFixed(0)} vs face ${plan.faceUp.toFixed(0)})`));
    assert.ok(plan.ring >= plan.size * 3, at('the shock ring is always visible'));
    // Neighbouring pillows never share a colour.
    rects.forEach((a, i) => rects.forEach((b, j) => {
      if (j <= i) return;
      const sameRow = Math.abs(a.top - b.top) < 4 && Math.abs(a.left + a.width - b.left) < 40;
      const sameColumn = Math.abs(a.left - b.left) < 4 && Math.abs(a.top + a.height - b.top) < 40;
      if (sameRow || sameColumn) assert.notEqual(plan.covers[i].tone, plan.covers[j].tone, at(`cards ${i} and ${j} differ in colour`));
    }));
    // Up to six cards, every bed gets its own colour (a 3 + 1 or 3 x 2 grid never shows two yellow beds).
    if (rects.length <= 6) assert.equal(new Set(plan.covers.map((cover) => cover.tone)).size, rects.length, at('every bed has its own colour'));
    assert.ok(plan.xMid > 0 && plan.xMid < vw);
  }
});

void test('squishy bounce: tall single rows get a real rim at the landing line and a bigger buddy', () => {
  for (const name of ['groups-1@1280x800', 'groups-4@1280x800', 'groups-5@1280x800', 'groups-6@1920x1080']) {
    const { rects, viewport } = layouts.find((layout) => layout.name === name)!;
    const plan = planSquishyBounce(rects, viewport);
    assert.ok(plan.lowered !== null && plan.lowered > .3 && plan.lowered < .5, `${name}: pillows lie in the lower part of the card (${plan.lowered})`);
    assert.ok(Math.abs(plan.yLand - viewport.height * .42) < 2, `${name}: landing line near 42% of the screen`);
    assert.equal(plan.size, buddySize(viewport, rects[0].height).size);
    assert.ok(plan.size >= Math.min(140, Math.round(Math.min(viewport.width, viewport.height) * .13)), `${name}: the hero is the bigger size`);
    assert.ok(plan.covers.every((cover) => cover.lowered && cover.face <= plan.size * 1.6 + 1), `${name}: every card has the headboard and a supporting-size face`);
    assert.ok(plan.landings.every((landing) => landing.sink > 60), `${name}: every landing visibly dips the rim`);
  }
  // Grids whose lower row has headroom keep their pillows at rest (and the smaller hero).
  for (const name of ['groups-8@1280x800', 'groups-12@1280x800', 'rotations-5@1280x800', 'rotations-4@1920x1080']) {
    const { rects, viewport } = layouts.find((layout) => layout.name === name)!;
    const plan = planSquishyBounce(rects, viewport);
    assert.equal(plan.lowered, null, `${name}: resting pillows`);
    assert.ok(plan.covers.every((cover) => !cover.lowered));
  }
  // 960x680 with a 3+1 grid: the top row's rims move down, so hops and the super jump have real air.
  const small = layouts.find((layout) => layout.name === 'groups-4@960x680')!;
  const plan = planSquishyBounce(small.rects, small.viewport);
  assert.ok(plan.lowered !== null);
  assert.ok(plan.hopEffective >= 48 && plan.yLand - plan.yApex >= 100, `hop ${plan.hopEffective}, super jump ${plan.yLand - plan.yApex}`);
  assert.ok(Math.abs(plan.hopEffective - Math.min(plan.hop, HOP_ROOM * (plan.yLand - plan.yApex))) < EPS);
  assert.ok(plan.covers.every((cover, index) => cover.pillowBottom - cover.pillowTop >= small.rects[index].height * MIN_PILLOW - EPS), 'the cushions stay at least MIN_PILLOW of the card');
});

void test('squishy bounce: after the reveal the buddy never rests on a label (Today and Groups, recorded in the lab)', () => {
  for (const [name, { vp, view, r, labels }] of Object.entries(LABEL_LAYOUTS)) {
    const scroller = view ? { left: view[0], top: view[1], width: view[2], height: view[3] } : undefined;
    const rects = r.map(([left, top, width, height]): Rect => ({ left, top, width, height, view: scroller }));
    const boxes = labels.map(([left, top, width, height]): Box => ({ left, top, width, height }));
    const viewport = { width: vp[0], height: vp[1] };
    const plan = planSquishyBounce(rects, viewport, boxes);
    const box = restBox(plan.xRest, plan.size, plan.yFloor, plan.rest.tuck);
    assert.equal(plan.rest.pose, 'rest', `${name}: a full-height spot is clear`);
    for (const label of boxes) {
      const overlap = Math.min(box.left + box.width, label.left + label.width) - Math.max(box.left, label.left) > .5 && Math.min(box.top + box.height, label.top + label.height) - Math.max(box.top, label.top) > .5;
      assert.ok(!overlap, `${name}: the rest box ${JSON.stringify(box)} clears label ${JSON.stringify(label)}`);
    }
    assert.ok(box.left >= 0 && box.left + box.width <= vp[0], `${name}: the rest spot is on screen`);
    const band = restBand(viewport);
    assert.ok(box.top >= band.top && box.top + box.height <= band.bottom + EPS, `${name}: the Stage's scan band covers the rest box`);
    assert.ok(boxes.every((label) => label.top < band.bottom), `${name}: labels are above the footer`);
  }
  // The two layouts from the review: 'Math games' (8x8) and 'Puzzles' (5x3 at 960x680) are no longer covered.
  const eight = LABEL_LAYOUTS['today-8x8@1280x800'];
  const plan = planSquishyBounce(eight.r.map(([left, top, width, height]): Rect => ({ left, top, width, height })), { width: 1280, height: 800 }, eight.labels.map(([left, top, width, height]) => ({ left, top, width, height })));
  assert.ok(plan.xRest < 497, 'Today 8x8: it rests in the Team column, right of the team name');
});

void test('squishy bounce: resting-spot rules (clear spans, peek fallback, least cover)', () => {
  const size = 88; const yFloor = 736; const vw = 1280;
  assert.deepEqual(planRest([], size, yFloor, vw, 640, false), { x: 640 + TOSS_SIDE * size, tuck: 0, pose: 'rest', overlap: 0 });
  assert.equal(planRest([], size, yFloor, vw, 640, true).tuck, FLOOR_TUCK);
  // A label right of the splat: the toss goes left instead.
  const right: Box = { left: 700, top: 700, width: 120, height: 30 };
  const left = planRest([right], size, yFloor, vw, 640, false);
  assert.ok(Math.abs(left.x - (640 - TOSS_SIDE * size)) < EPS, `left: ${left.x}`);
  // Labels everywhere at full height but a gap low down: peek depth.
  const row: Box[] = Array.from({ length: 16 }, (_, k) => ({ left: k * 80, top: 620, width: 70, height: 20 }));
  const peek = planRest(row, size, yFloor, vw, 640, false);
  assert.equal(peek.pose, 'peek'); assert.equal(peek.tuck, PEEK_TUCK); assert.equal(peek.overlap, 0);
  // Nothing clear at all: the spot that covers the least.
  const wall: Box[] = [{ left: 0, top: 600, width: 1280, height: 136 }, { left: 0, top: 700, width: 600, height: 30 }];
  const least = planRest(wall, size, yFloor, vw, 640, false);
  assert.equal(least.pose, 'peek');
  assert.ok(least.x > 600 + size * .55, `least cover: ${least.x}`);
  // Free spans are exact: a box centred at a span's edge just touches the label.
  const spans = freeRestSpans([right], size, yFloor, 0, 0, vw);
  const half = restBox(0, size, yFloor, 0).width / 2;
  assert.deepEqual(spans, [[0, 700 - half], [820 + half, vw]]);
  // Labels below the floor line (behind the footer) never block.
  assert.deepEqual(freeRestSpans([{ left: 600, top: 740, width: 100, height: 20 }], size, yFloor, 0, 0, vw), [[0, vw]]);
});

void test('squishy bounce: art details from the review (face frames clip, rings grow from the splat, prefixed clip)', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  assert.match(css, /\.sq-frame \{[^}]*overflow: hidden/, 'each face frame clips its own features');
  assert.match(css, /\.sq-pillow \{[^}]*inset: var\(--sq-pillow-top, 4%\)/, 'the pillow top follows the plan');
  assert.match(css, /\.sq-splat, \.sq-hits, \.sq-breathe \{[^}]*transform-origin: 50% 97\.5%/, 'pillows squash about their own bottom edge');
  assert.ok(Math.abs(.975 - (1 - PILLOW_INSET_BOTTOM)) < EPS && PILLOW_INSET_TOP === .04);
  const shock = /@keyframes sqb-shock \{ 0% \{ transform: scale\(([\d.]+)\)/.exec(css);
  assert.ok(shock && Math.abs(Number(shock[1]) - SHOCK_FROM) < EPS, 'the ring starts at SHOCK_FROM of its size');
  const generated = squishyKeyframesCss();
  const run = Math.round(SHOCK * (1 - SHOCK_FROM) * 1000);
  assert.ok(generated.includes(`.sqb-shock{animation:sqb-shock ${run}ms linear ${Math.round((SPLAT + SHOCK * SHOCK_FROM) * 1000)}ms both}`), 'ring radius = ring * (t - SPLAT) / SHOCK, in step with the squash wave');
  assert.ok(generated.includes(`.sqb-shock-2{animation:sqb-shock ${run}ms linear ${Math.round((SPLAT + SHOCK * SHOCK_FROM + SHOCK_ECHO) * 1000)}ms both}`), 'a trailing second ring');
  const tsx = readFileSync(TSX_PATH, 'utf8');
  assert.ok(/sqb-splat-at">\s*<i className="sqb-shock" \/>/.test(tsx), 'the rings ride the buddy Y track with the splat star');
  assert.ok(tsx.includes("'-webkit-clip-path'"), 'older WebKit gets the prefixed clip');
  // The splat star pops on every pastel: big, white, outlined like the buddy, centred above the pancake.
  assert.match(tsx, /className="sqb-star"[^>]*><path [^>]*fill="#fff" stroke="#2A9277" strokeWidth="4"/);
  const star = /\.sqb-star \{[^}]*left: (-?[\d.]+)em; top: (-?[\d.]+)em; width: ([\d.]+)em; height: ([\d.]+)em/.exec(css);
  assert.ok(star && Number(star[3]) >= 2.4 && Number(star[2]) + Number(star[4]) / 2 <= -.25, 'the star is ~2.4B, centred above the pancake');
  // Tall cards: a tufted headboard (buttons joined by pleats) with a stitched sleepy-moon appliqué.
  assert.match(css, /\.sq-cover\[data-sq-lowered\] \.sq-bed::before \{[^}]*radial-gradient\(circle, var\(--sq-rim\) 0 3\.4px[^}]*linear-gradient\(to top right[^}]*linear-gradient\(var\(--sq-deep\), var\(--sq-main\) 48%, var\(--sq-light\)\)/);
  assert.match(css, /\.sq-appl \{ display: none; \}/);
  // Exits pop (scale away while solid) rather than leaving half-faded outlines over the names.
  assert.match(css, /@keyframes sqb-star \{[^@]*92% \{ opacity: 1; \} 100% \{ transform: scale\(0\)[^}]*opacity: 0; \} \}/, 'the splat star pops back in, solid');
  assert.match(css, /@keyframes sq-bed-poof \{[^@]*86% \{ opacity: 1; \} 100% \{ opacity: 0; transform: scale\(0\); \} \}/, 'the bed pops away, solid');
  // A light first frame: the measuring pass's forced layout only styles the beds; each pillow subtree is styled once, when ready.
  assert.match(css, /\.sq-cover:not\(\[data-sq-ready\]\) \.sq-splat \{ display: none; \}/);
  assert.ok(SQUISHY_COVER_HTML.includes('class="sq-appl"') && SQUISHY_COVER_HTML.indexOf('sq-appl') < SQUISHY_COVER_HTML.indexOf('</i>'), 'the appliqué is part of the bed (it poofs with it)');
  // A resize rewrites geometry and squash amounts, never the start times.
  const cover = planSquishyBounce(layouts[1].rects, layouts[1].viewport).covers[0];
  const resized = geometryVars(cover.vars);
  for (const name of TIMING_VARS) { assert.ok(name in cover.vars, name); assert.ok(!resized.includes(name), name); }
  for (const name of ['--sq-pillow-top', '--sq-face-y', '--sq-sy', '--sq-ssy']) assert.ok(resized.includes(name), name);
  for (const [, name] of squishyKeyframesCss().matchAll(/var\((--sq-[\w-]+)\)/g)) if (name.endsWith('-at')) assert.ok(TIMING_VARS.includes(name), `${name} is a timing var`);
});

void test('squishy bounce: row tops tolerate sub-pixel layout noise', () => {
  assert.deepEqual(rowTops([{ left: 0, top: 100, width: 10, height: 10 }, { left: 20, top: 102.5, width: 10, height: 10 }, { left: 0, top: 200, width: 10, height: 10 }]), [100, 200]);
});

void test('squishy bounce: a scrolled Today table never lands the buddy off the table, and escaping covers are clipped', () => {
  // Five rounds in a table scroller 1208 px wide: round 4 is two-thirds scrolled away, round 5 fully.
  const view = { left: 36, top: 60, width: 1208, height: 700 };
  const rects: Rect[] = [];
  for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) rects.push({ left: 380 + 260 * column, top: 100 + 70 * row, width: 250, height: 60, view });
  const plan = planSquishyBounce(rects, { width: 1280, height: 800 });
  assert.equal(plan.pattern.length, 3, 'only the three rounds the class can see are hopped on');
  for (const landing of plan.landings) assert.ok(landing.x > view.left + 40 && landing.x < view.left + view.width - 40, 'every landing is on the visible table');
  assert.equal(coverClip(rects[0]), null, 'cards fully inside their scroller are not clipped (their pillows fly freely)');
  const cut = coverClip(rects[3]);
  assert.ok(typeof cut === 'string' && cut.startsWith('polygon(-4000px -4000px, 84px -4000px, 84px 4060px, -4000px 4060px'), `only the scrolled-away side is clipped (${String(cut)})`);
  assert.equal(coverClip(rects[4]), 'hidden', 'a card scrolled fully away is hidden');
  assert.equal(coverClip({ left: 0, top: 0, width: 10, height: 10 }), null, 'no scroller, no clip');
  for (const cover of plan.covers) assert.ok(cover.splatAt >= SPLAT && cover.splatAt <= SPLAT + SPLAT_SPREAD + EPS && cover.splatAt + HOLD + FLY <= COVERS_GONE + 1e-6, 'hidden and clipped cards still finish on time');
});

/** A cover's splat-track translateY (px) at t seconds into its splat, as the browser plays the keys with the cover's variables. */
function translateYAt(keys: readonly Key[], vars: Record<string, string>, t: number): number {
  const y = (value: string) => {
    const match = /translate\([^,]+,(?:var\((--[\w-]+)\)|(-?[\d.]+)px)\)/.exec(value);
    assert.ok(match, `a translate in ${value}`);
    return match[1] ? parseFloat(vars[match[1]]) : Number(match[2]);
  };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= t + 1e-9) i++;
  if (i + 1 >= keys.length || Math.abs(keys[i][0] - t) < 1e-9) return y(keys[i][1]);
  const [from, value, ease] = keys[i];
  const [to, next] = keys[i + 1];
  return y(value) + (y(next) - y(value)) * easeAt((ease ?? 'lin') as Ease, (t - from) / (to - from));
}

void test('squishy bounce: the BOING clears each card quickly (the bed pops with the launch, the pillow zooms off its names)', () => {
  assert.equal(BED_POOF_DELAY, HOLD, 'the bed pops on the BOING, so no bare bed is left behind a launched pillow');
  assert.ok(BED_POOF <= .16, 'a quick pop');
  assert.equal(SPLAT_KEYS.find(([time]) => Math.abs(time - (HOLD + .08)) < EPS)![2], FLY_EASE);
  assert.ok(easeAt(FLY_EASE, .25) >= .12 && easeAt(FLY_EASE, .5) >= .35, 'the flight zooms off instead of lifting off slowly');
  assert.ok(Math.abs(parseFloat(planSquishyBounce(layouts[1].rects, layouts[1].viewport).covers[0].vars['--sq-fly0']) - planSquishyBounce(layouts[1].rects, layouts[1].viewport).covers[0].fly * BOING_LIFT) < .1);
  let worst = 0; let slowest = 0;
  for (const { name, rects, viewport } of layouts) {
    const plan = planSquishyBounce(rects, viewport);
    plan.covers.forEach((cover, index) => {
      const r = rects[index];
      if (r.height < 120) return; // short cells: the pillow clears its own cell at once
      const bedGone = cover.splatAt + BED_POOF_DELAY + BED_POOF;
      // A card's first names sit ~90 px below its top: find when the pillow's bottom edge (its scale origin) has risen above them.
      let t = HOLD;
      while (t < SPLAT_DURATION && r.top + cover.pillowBottom + translateYAt(SPLAT_KEYS, cover.vars, t) > r.top + 90) t += .005;
      const late = cover.splatAt + t - bedGone;
      worst = Math.max(worst, late); slowest = Math.max(slowest, t);
      assert.ok(late <= .18, `${name}: card ${index}'s names are clear of its pillow ${late.toFixed(3)} s after its bed popped`);
      assert.ok(t <= HOLD + .31, `${name}: card ${index}'s pillow is off its names ${(t - HOLD).toFixed(3)} s after the BOING`);
    });
  }
  if (process.env.SQUISHY_REPORT) console.log(`names clear at most ${worst.toFixed(3)} s after the bed pops, ${(slowest - HOLD).toFixed(3)} s after the BOING`);
});
