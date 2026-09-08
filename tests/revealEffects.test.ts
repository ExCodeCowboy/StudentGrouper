import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRevealEffect, revealEffects } from '../src/revealEffects/registry';
import { CAT_DURATION_MS, CAT_LEGS, CAT_LEG_LENGTHS, CAT_STRIDE, catActing, catBlocking, catFoot, catRig, catTravel, catWalking, MOON_DURATION_MS } from '../src/revealEffects/sceneMotion';

const CAT_VIEWPORTS = [640, 960, 1280, 1920];

function sceneRig(time: number, viewportWidth: number) {
  const blocking = catBlocking(time, viewportWidth);
  return { blocking, rig: catRig(time, blocking.distance / blocking.scale, blocking.strideOffset) };
}

function assertConnectedLegs(rig: ReturnType<typeof catRig>, context: string) {
  for (const { key, hip, knee, ankle, foot, hind, toeAngle } of rig.legs) {
    const label = `${context}, ${key}`;
    const [upper, lower, distal] = CAT_LEG_LENGTHS[hind ? 'hind' : 'front'];
    assert.ok(Math.abs(Math.hypot(hip.x - knee.x, hip.y - knee.y) - upper) < 1e-8, `${label}: upper segment stays rigid`);
    assert.ok(Math.abs(Math.hypot(ankle.x - knee.x, ankle.y - knee.y) - lower) < 1e-8, `${label}: lower segment stays rigid`);
    assert.ok(Math.abs(Math.hypot(foot.x - ankle.x, foot.y - ankle.y) - distal) < 1e-8, `${label}: distal segment stays rigid`);
    assert.ok(ankle.y < foot.y - 15, `${label}: wrist/hock remains above the toe contact`);
    assert.ok(foot.y <= 274, `${label}: paw stays above the floor`);
    if (foot.y === 274) assert.equal(toeAngle, 0, `${label}: planted and resting paws remain flat`);
    const angle = toeAngle * Math.PI / 180;
    for (const [x, y] of [[-7, -2], [-3, 0], [6, 0], [13, -1], [13, -6], [7, -8]]) {
      assert.ok(foot.y + x * Math.sin(angle) + y * Math.cos(angle) <= 274 + 1e-8, `${label}: curled paw outline clears the ground`);
    }
    const bend = (ankle.x - hip.x) * (knee.y - hip.y) - (ankle.y - hip.y) * (knee.x - hip.x);
    assert.ok(hind ? bend < 0 : bend > 0, `${label}: knees bend forwards and elbows backwards without flipping`);
  }
}

void test('each registered reveal is selectable and completes within its brief presentation window', () => {
  assert.equal(new Set(revealEffects.map((effect) => effect.id)).size, revealEffects.length);
  for (const effect of revealEffects) {
    assert.equal(resolveRevealEffect(effect.id), effect);
    const budget = { fairy: 3200, cat: 7000, moon: 9000, confetti: 3800 }[effect.id] ?? 3000;
    assert.ok(effect.durationMs > 0 && effect.durationMs <= budget);
    assert.equal(typeof effect.Stage, 'function');
    assert.equal(typeof effect.Cover, 'function');
  }
});

void test('the cat plants its paws without sliding and lifts them only on the return stroke', () => {
  const hip = 341;
  for (let cycle = 0; cycle < 4; cycle++) {
    const firstDistance = (cycle + .08) * CAT_STRIDE;
    const laterDistance = (cycle + .35) * CAT_STRIDE;
    const first = catFoot(firstDistance, 0, hip);
    const later = catFoot(laterDistance, 0, hip);
    assert.ok(Math.abs(firstDistance + first.x - laterDistance - later.x) < 1e-8);
    assert.equal(first.y, 274);
    assert.equal(later.y, 274);
    const lifted = catFoot((cycle + .8) * CAT_STRIDE, 0, hip).y;
    assert.ok(lifted < 254 && lifted >= 238);
  }
  const beforeWrap = catFoot(CAT_STRIDE - .0001, 0, hip);
  const afterWrap = catFoot(CAT_STRIDE + .0001, 0, hip);
  assert.ok(Math.hypot(beforeWrap.x - afterWrap.x, beforeWrap.y - afterWrap.y) < .001);
});

void test('the cat joints stay connected through every phase of its raised trot', () => {
  for (let distance = 0; distance < CAT_STRIDE * 2; distance += 2) {
    assertConnectedLegs(catRig(1, distance), `trot distance ${distance}`);
  }
});

void test('the cat keeps its joints and paw contours sound throughout the actual responsive scene', () => {
  for (const width of CAT_VIEWPORTS) for (let tick = 0; tick <= CAT_DURATION_MS / 5; tick++) {
    const time = tick * .005;
    assertConnectedLegs(sceneRig(time, width).rig, `${width}px at ${time.toFixed(3)}s`);
  }
});

void test('the cat moves its shoulders and haunches and changes travel speed without a jump', () => {
  const first = catRig(1, 0);
  const next = catRig(1, CAT_STRIDE * .4);
  for (const [index, leg] of first.legs.entries()) {
    assert.ok(Math.hypot(leg.hip.x - next.legs[index].hip.x, leg.hip.y - next.legs[index].hip.y) > 1, 'every upper joint participates in the walk');
  }
  for (const boundary of [2.65, 3.75]) {
    const h = .0001;
    assert.ok(Math.abs(catTravel(boundary + h) - catTravel(boundary - h)) / (2 * h) < .001, 'the cat stops and resumes without a velocity jump');
  }
});

void test('three support paws stay planted while the near forepaw investigates and taps the yarn', () => {
  for (const width of CAT_VIEWPORTS) {
    const start = sceneRig(2.65, width);
    for (let tick = 0; tick <= 220; tick++) {
      const { blocking, rig } = sceneRig(2.65 + tick * .005, width);
      for (const [index, leg] of rig.legs.entries()) {
        if (leg.key === 'near-front') continue;
        const startX = start.blocking.x + start.rig.legs[index].foot.x * start.blocking.scale;
        const currentX = blocking.x + leg.foot.x * blocking.scale;
        assert.ok(Math.abs(currentX - startX) < 1e-8, `${width}px: ${leg.key} holds its world footprint during the gesture`);
        assert.equal(leg.foot.y, 274, `${width}px: ${leg.key} continues supporting the body`);
      }
    }
    const lifted = sceneRig(3.04, width).rig.legs.find(leg => leg.key === 'near-front')!;
    assert.ok(lifted.foot.y < 240, 'the near forepaw visibly lifts instead of keeping the old four-paw idle pose');
    const returned = sceneRig(3.62, width).rig.legs.find(leg => leg.key === 'near-front')!;
    const original = start.rig.legs.find(leg => leg.key === 'near-front')!;
    assert.ok(Math.hypot(returned.foot.x - original.foot.x, returned.foot.y - original.foot.y) < 1e-8, 'the gesture returns to its footprint before the next step');
  }
  assert.ok(catActing(3.04).inspect > 0 && catActing(3.04).lookDown > 0, 'the lifted paw accompanies attention toward the toy');
});

void test('the rotated near-front toe touches the ball at the authored contact time at every scene width', () => {
  for (const width of CAT_VIEWPORTS) for (const time of [3.04, 3.22]) {
    const { blocking, rig } = sceneRig(time, width);
    const leg = rig.legs.find(leg => leg.key === 'near-front')!;
    const angle = leg.toeAngle * Math.PI / 180;
    // Upper-right corner of the drawn paw, transformed to floor-relative scene coordinates.
    const toeX = blocking.x + (leg.foot.x + 13 * Math.cos(angle) + 6 * Math.sin(angle)) * blocking.scale;
    const toeY = (leg.foot.y - 274 + 13 * Math.sin(angle) - 6 * Math.cos(angle)) * blocking.scale;
    const radius = 36 * blocking.scale;
    const gap = Math.hypot(toeX - blocking.ballX, toeY + radius) - radius;
    if (time === 3.22) assert.ok(Math.abs(gap) < .5 * blocking.scale, `${width}px: toe reaches the yarn surface at contact`);
    else assert.ok(gap > 30 * blocking.scale, `${width}px: lifted paw is still clear of the yarn before its reach`);
  }
});

void test('the yarn stops before the cat, restarts only after the tap, and clears the reveal without moving backwards', () => {
  for (const width of CAT_VIEWPORTS) {
    let previous = catBlocking(0, width).ballX;
    for (let tick = 1; tick <= CAT_DURATION_MS / 5; tick++) {
      const blocking = catBlocking(tick * .005, width);
      assert.ok(blocking.ballX >= previous, `${width}px: yarn always rolls forwards`);
      assert.ok(blocking.ballDistance >= 0, `${width}px: yarn rotation follows forward travel`);
      previous = blocking.ballX;
    }
    const stopped = catBlocking(2.4, width);
    for (let tick = 0; tick <= 164; tick++) {
      assert.equal(catBlocking(2.4 + tick * .005, width).ballX, stopped.ballX, 'the ball rests until the 3.22-second tap');
    }
    assert.ok(catBlocking(2.5, width).x > stopped.x, 'the cat catches up after the ball stops');
    assert.equal(catBlocking(3.45, width).x, catBlocking(3.22, width).x, 'the cat watches before deciding to follow');
    assert.ok(catBlocking(3.45, width).ballX > catBlocking(3.22, width).ballX, 'the tap releases the ball independently');
    assert.ok(catBlocking(3.9, width).x > catBlocking(3.75, width).x, 'the cat resumes pursuit after the pause');
    for (const boundary of [2.4, 6.6]) {
      const h = .00001;
      const speed = Math.abs(catBlocking(boundary + h, width).ballX - catBlocking(boundary - h, width).ballX) / (2 * h);
      assert.ok(speed < .1, `${width}px: the toy rolls to a smooth stop`);
    }
    const h = .00001;
    const contactX = catBlocking(3.22, width).ballX;
    assert.ok(Math.abs(contactX - stopped.ballX) < 1e-8, 'the tap imparts velocity without teleporting the ball');
    const impulseSpeed = (catBlocking(3.22 + h, width).ballX - contactX) / h;
    const coastSpeed = (catBlocking(3.5 + h, width).ballX - catBlocking(3.5, width).ballX) / h;
    assert.ok(impulseSpeed > coastSpeed * .25 && impulseSpeed < coastSpeed, 'contact starts the ball promptly, then the paw finishes its push');
    assert.ok(catBlocking(3.23, width).ballX - contactX > .5 * catBlocking(3.23, width).scale, 'the yarn visibly responds immediately after contact');
    assert.ok(catBlocking(CAT_DURATION_MS / 1000, width).ballX > width, 'the yarn has crossed the whole screen before the scene expires');
  }
});

void test('the cat trots in diagonal pairs, briefly lifts between beats, and returns to previous footprints', () => {
  const contacts: string[][] = [];
  for (let step = 0; step < 2; step++) {
    const distance = step * CAT_STRIDE / 2;
    const beat: string[] = [];
    for (const leg of CAT_LEGS) {
      const before = catFoot(distance - .01, leg.phase, leg.hipX);
      const after = catFoot(distance + .01, leg.phase, leg.hipX);
      if (before.y < 274 && after.y === 274) beat.push(leg.key);
    }
    contacts.push(beat.sort());
  }
  assert.deepEqual(contacts, [['far-front', 'near-hind'], ['far-hind', 'near-front']]);
  for (const phase of [.48, .98]) {
    assert.ok(CAT_LEGS.every(leg => catFoot(phase * CAT_STRIDE, leg.phase, leg.hipX).y < 274), 'brief suspension between diagonal supports');
  }
  for (const far of [false, true]) {
    const hind = CAT_LEGS.find(leg => leg.hind && leg.far === far)!;
    const front = CAT_LEGS.find(leg => !leg.hind && leg.far === far)!;
    const hindContact = (2 - hind.phase) * CAT_STRIDE;
    const previousFrontContact = hindContact - CAT_STRIDE * .5;
    const hindPrint = hindContact + catFoot(hindContact, hind.phase, hind.hipX).x;
    const frontPrint = previousFrontContact + catFoot(previousFrontContact, front.phase, front.hipX).x;
    assert.ok(Math.abs(hindPrint - frontPrint) < 10, 'rear paw returns within a paw width of the front footprint');
  }
});

void test('the illustrated stories finish within playback and the cat pause does not move its position', () => {
  assert.equal(resolveRevealEffect('cat')?.durationMs, CAT_DURATION_MS);
  assert.equal(resolveRevealEffect('moon')?.durationMs, MOON_DURATION_MS);
  assert.equal(catTravel(0), 0);
  assert.equal(catTravel(2.8), catTravel(3.3));
  assert.equal(catWalking(3), 0);
  assert.equal(catTravel(CAT_DURATION_MS / 1000), 1);
  let previous = 0;
  for (let time = 0; time < CAT_DURATION_MS / 1000; time += .01) {
    const current = catTravel(time);
    assert.ok(current >= previous && current <= 1);
    previous = current;
  }
});

void test('surprise reveals never immediately repeat and can reach every other registered effect', () => {
  for (const previous of revealEffects) {
    const choices = new Set(Array.from({ length: 100 }, (_, index) => resolveRevealEffect('surprise', previous.id, () => index / 100)?.id));
    assert.ok(!choices.has(previous.id));
    assert.deepEqual(choices, new Set(revealEffects.filter((effect) => effect.id !== previous.id).map((effect) => effect.id)));
  }
});

void test('off and removed effects resolve to no animation', () => {
  assert.equal(resolveRevealEffect('none'), null);
  assert.equal(resolveRevealEffect('removed-effect'), null);
});
