(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const DUTY = .65, SWING = 1 - DUTY;
  const RADIUS = 1.48, HIP_RADIUS = .71, HIP_DROP = -.10;
  const LIFT = .12, PLAN_REACH = .985, MAX_REACH = .99;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => x * x * x * (x * (x * 6 - 15) + 10);
  const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  window.createGroundedGait = function () {
    let feet = null, active = false, phaseOrigin = 0;
    let nextLift = [0, .5], rejectedPlans = 0;
    let diagnostics = {}, previousCommand = null, recovery = null;
    let hasWalked = false, motionScale = 1;

    function bodyToWorld(body, x, z) {
      const c = Math.cos(body.yaw), s = Math.sin(body.yaw);
      return {x: body.x + c * x + s * z, z: body.z - s * x + c * z};
    }
    function worldToBody(body, point) {
      const c = Math.cos(body.yaw), s = Math.sin(body.yaw);
      const dx = point.x - body.x, dz = point.z - body.z;
      return {x: c * dx - s * dz, z: s * dx + c * dz};
    }
    // Exact planar constant-velocity prediction in the same coordinates as app.js.
    function predictBody(state, seconds) {
      const v = state.move * state.speed * .16;
      const w = state.turn * state.speed * .10;
      const yaw = state.yaw + w * seconds;
      let x = state.x, z = state.z;
      if (Math.abs(w) < 1e-8) {
        x -= Math.sin(state.yaw) * v * seconds;
        z -= Math.cos(state.yaw) * v * seconds;
      } else {
        x += v / w * (Math.cos(yaw) - Math.cos(state.yaw));
        z -= v / w * (Math.sin(yaw) - Math.sin(state.yaw));
      }
      return {x, z, yaw};
    }
    function reach(body, foot, lift = 0) {
      const p = worldToBody(body, foot);
      return Math.hypot(p.x - HIP_RADIUS * Math.cos(foot.angle),
        p.z - HIP_RADIUS * Math.sin(foot.angle), HIP_DROP + lift);
    }
    function initialize(state) {
      feet = Array.from({length: 6}, (_, i) => {
        const angle = (i + .5) * Math.PI / 3;
        const p = bodyToWorld(state, RADIUS * Math.cos(angle), RADIUS * Math.sin(angle));
        return {index: i, group: i % 2, angle, x: p.x, z: p.z,
          yaw: state.yaw - angle, lift: 0, mode: 'stance'};
      });
    }
    function sampleSwing(from, to, u) {
      const f = ease(clamp(u, 0, 1));
      return {x: from.x + (to.x - from.x) * f,
        z: from.z + (to.z - from.z) * f,
        yaw: from.yaw + wrap(to.yaw - from.yaw) * f,
        lift: LIFT * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 2)};
    }
    function beginRecoveryGroup(state) {
      const group = recovery.groups[recovery.stage];
      for (const foot of feet) if (foot.group === group) {
        foot.from = {x: foot.x, z: foot.z, yaw: foot.yaw, lift: foot.lift};
        foot.to = bodyToWorld(state, RADIUS * Math.cos(foot.angle), RADIUS * Math.sin(foot.angle));
        foot.to.yaw = state.yaw - foot.angle;
        foot.mode = 'recovering'; foot.recoverTime = 0;
      }
    }
    function beginRecovery(state) {
      if (recovery || !feet) return;
      // Finish the currently unsupported tripod first. The other three anchors
      // remain fixed. With a stationary body, these convex paths stay reachable.
      const raised = feet.find(foot => foot.mode !== 'stance');
      const first = raised ? raised.group : 0;
      recovery = {groups: [first, 1 - first], stage: 0};
      active = false; beginRecoveryGroup(state);
    }
    function settleRaisedFeet() {
      for (const foot of feet || []) if (foot.mode !== 'stance' && foot.mode !== 'settling') {
        foot.mode = 'settling'; foot.settleTime = 0;
        foot.settleLift = foot.lift; foot.settleDuration = .22;
      }
    }
    // Call BEFORE integrating body x/z/yaw. A change of travel direction needs a
    // short stance recovery; changing only speed does not, because stride length
    // is independent of speed. The gait phase continues while the body pauses.
    function prepareMotion(state, dt = 1 / 60) {
      if (state.deploy < .999) { motionScale = 0; return 0; }
      const moving = Math.abs(state.move) + Math.abs(state.turn) > .001;
      const changed = previousCommand &&
        Math.abs(state.move - previousCommand.move) + Math.abs(state.turn - previousCommand.turn) > .05;
      if (changed && feet) {
        if (!moving) { recovery = null; active = false; settleRaisedFeet(); }
        else if (hasWalked) beginRecovery(state);
      }
      previousCommand = {move: state.move, turn: state.turn};
      if (!moving || recovery || (feet && feet.some(foot => foot.mode === 'settling'))) {
        motionScale = 0; return 0;
      }
      if (!feet) { motionScale = 1; return 1; }
      // Never move the body past an existing contact's reachable workspace.
      // This is a guard on body motion, not a clamp that slides a supporting foot.
      const fits = amount => {
        const candidate = predictBody(state, Math.max(0, dt) * amount);
        return feet.every(foot => reach(candidate, foot, foot.lift) <= .975);
      };
      if (fits(1)) { motionScale = 1; return 1; }
      if (!fits(0)) { beginRecovery(state); motionScale = 0; return 0; }
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      motionScale = lo; return lo;
    }
    function planStep(state, foot) {
      const period = 2 / Math.max(.05, state.speed);
      // Place the ankle relative to the predicted body at the middle of stance.
      const middle = predictBody(state, period * (SWING + DUTY / 2));
      const from = {x: foot.x, z: foot.z, yaw: foot.yaw};
      for (const radius of [RADIUS, RADIUS - .02, RADIUS - .04, RADIUS - .06, RADIUS - .08]) {
        const target = bodyToWorld(middle, radius * Math.cos(foot.angle), radius * Math.sin(foot.angle));
        target.yaw = middle.yaw - foot.angle;
        let safe = true;
        // Check the entire next swing and stance, not just the endpoint.
        for (let j = 0; j <= 32; j++) {
          const u = j / 32, body = predictBody(state, u * period);
          const p = u < SWING ? sampleSwing(from, target, u / SWING)
            : {x: target.x, z: target.z, lift: 0};
          p.angle = foot.angle;
          if (reach(body, p, p.lift) > PLAN_REACH) { safe = false; break; }
        }
        if (safe) return {from, to: target};
      }
      return null;
    }
    function reset() {
      feet = null; active = false; phaseOrigin = 0;
      nextLift = [0, .5]; rejectedPlans = 0; diagnostics = {};
      previousCommand = null; recovery = null; hasWalked = false; motionScale = 1;
    }
    function update(state, dt) {
      if (state.deploy < .999) { reset(); return null; }
      if (!feet) initialize(state);
      // Also recognize commands for callers inspecting poses without integrating
      // motion. Interactive callers must use prepareMotion before body movement.
      prepareMotion(state, 0);
      const moving = Math.abs(state.move) + Math.abs(state.turn) > .001;
      const clock = state.phase / TAU - phaseOrigin;

      if (!moving) {
        active = false;
        // Stop without changing a grounded foot's anchor. A raised foot lowers
        // vertically from its current position, with no snap to its planned step.
        settleRaisedFeet();
      }

      for (const foot of feet) {
        if (foot.mode === 'swing') {
          const u = clamp((clock - foot.liftClock) / SWING, 0, 1);
          Object.assign(foot, sampleSwing(foot.from, foot.to, u));
          if (u >= 1) {
            foot.x = foot.to.x; foot.z = foot.to.z; foot.yaw = foot.to.yaw;
            foot.lift = 0; foot.mode = 'stance';
          }
        } else if (foot.mode === 'recovering') {
          foot.recoverTime += Math.max(0, dt);
          const u = clamp(foot.recoverTime / .32, 0, 1);
          const p = sampleSwing(foot.from, foot.to, u);
          const base = foot.from.lift * (1 - ease(u));
          p.lift = base + (LIFT - base) * Math.pow(Math.sin(Math.PI * u), 2);
          Object.assign(foot, p);
          if (u >= 1) { foot.x = foot.to.x; foot.z = foot.to.z; foot.yaw = foot.to.yaw; foot.lift = 0; foot.mode = 'stance'; }
        } else if (foot.mode === 'settling') {
          foot.settleTime += Math.max(0, dt);
          const u = clamp(foot.settleTime / foot.settleDuration, 0, 1);
          foot.lift = foot.settleLift * (1 - ease(u));
          if (u >= 1) { foot.lift = 0; foot.mode = 'stance'; }
        }
      }

      if (recovery && feet.every(foot => foot.mode === 'stance')) {
        recovery.stage++;
        if (recovery.stage < recovery.groups.length) beginRecoveryGroup(state);
        else recovery = null;
      }

      if (moving && !recovery && !active && feet.every(foot => foot.mode === 'stance')) {
        // Start a tripod immediately, at zero lift. Realigning only the gait
        // clock avoids a position jump and avoids an overlong first stance.
        const groupReach = [0, 0];
        const firstStanceEnd = predictBody(state, 1 / Math.max(.05, state.speed));
        for (const foot of feet) groupReach[foot.group] = Math.max(groupReach[foot.group], reach(firstStanceEnd, foot));
        const first = groupReach[0] > groupReach[1] ? 0 : 1;
        phaseOrigin = state.phase / TAU;
        nextLift[first] = 0; nextLift[1 - first] = .5;
        active = true; hasWalked = true;
      }

      const currentClock = state.phase / TAU - phaseOrigin;
      if (moving && !recovery && active) for (let group = 0; group < 2; group++) {
        if (currentClock + 1e-9 < nextLift[group]) continue;
        const tripod = feet.filter(foot => foot.group === group);
        const supports = feet.filter(foot => foot.group !== group);
        if (!tripod.every(foot => foot.mode === 'stance') ||
            !supports.every(foot => foot.mode === 'stance')) continue;
        const plans = tripod.map(foot => planStep(state, foot));
        if (plans.some(plan => !plan)) {
          rejectedPlans++;
          // Do not drag a supporting foot or clamp its target to disguise an
          // unreachable command. Diagnostics let the caller slow/stop the body.
          beginRecovery(state); break;
        }
        tripod.forEach((foot, i) => {
          foot.from = plans[i].from; foot.to = plans[i].to;
          foot.liftClock = currentClock; foot.mode = 'swing';
        });
        nextLift[group] = currentClock + 1;
      }

      const targets = feet.map(foot => {
        const p = worldToBody(state, foot);
        return {x: p.x, z: p.z, lift: foot.lift, yaw: wrap(foot.yaw - state.yaw)};
      });
      const maxReach = Math.max(...feet.map(foot => reach(state, foot, foot.lift)));
      const supports = feet.filter(foot => foot.mode === 'stance');
      const future = predictBody(state, .16 / Math.max(.05, state.speed));
      const predictedSupportReach = Math.max(0, ...supports.map(foot => reach(future, foot)));
      diagnostics = {maxReach, reachOK: maxReach <= MAX_REACH,
        predictedSupportReach, contactCount: supports.length,
        dutyFactor: DUTY, rejectedPlans,
        recovering: !!recovery,
        suggestedMotionScale: recovery ? 0 : Math.min(motionScale, clamp((MAX_REACH - predictedSupportReach) / .025, 0, 1)),
        interpretation: 'Kinematic ground contacts; no force, friction or dynamics simulation.'};
      return targets;
    }
    function getContacts() {
      return feet ? feet.map(foot => ({index: foot.index, x: foot.x, z: foot.z,
        yaw: foot.yaw, lift: foot.lift, grounded: foot.mode === 'stance', mode: foot.mode})) : [];
    }
    return {update, reset, prepareMotion, getContacts, getDiagnostics: () => ({...diagnostics})};
  };
})();
