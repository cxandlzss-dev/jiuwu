const MAX_DRUNK = 100;
const BASE_DRUNK_PER_CUP = 10;
const HAND_SIZE = 3;
const LOG_LIMIT = 18;

const CARD_POOL = [
  { id: "pretend_drunk", name: "装醉", icon: "😴", tone: "plum", desc: "下回合无视对方让你喝的酒。", flavor: "趴桌三秒，酒桌系统临时查无此人。", kind: "defense", rarity: "common", weight: 1 },
  { id: "flatter", name: "奉承", icon: "🙇", tone: "amber", desc: "让对方本回合多喝 1 杯。", flavor: "这话一说出口，对面不喝都像不给面子。", kind: "attack", rarity: "common", weight: 1 },
  { id: "dilute", name: "掺水", icon: "🫗", tone: "jade", desc: "本回合你喝的酒只按 50% 酒醉度结算。", flavor: "白的变清的，脸上还得装得很真诚。", kind: "defense", rarity: "common", weight: 1 },
  { id: "raise_fish", name: "养鱼", icon: "🐟", tone: "teal", desc: "本回合你喝的酒只按 75% 酒醉度结算。", flavor: "酒杯里讲究一个缓慢游泳，绝不一口到底。", kind: "defense", rarity: "common", weight: 1 },
  { id: "water_as_wine", name: "指水为酒", icon: "💧", tone: "rare-water", desc: "本回合你喝的酒不产生酒醉度。", flavor: "睁眼说瞎话，杯里全是正经自来水。", kind: "defense", rarity: "rare", weight: 0.22 },
  { id: "red_bull", name: "喝红牛", icon: "🥤", tone: "rare-bull", desc: "立刻增加 1 次绝活使用机会。", flavor: "先把精神顶上来，今晚还能再来一手绝活。", kind: "boost", rarity: "rare", weight: 0.24 },
  { id: "snack_guard", name: "下酒菜", icon: "🍢", tone: "gold", desc: "立刻降低 12 点酒醉度。", flavor: "一口关东煮下去，灵魂都坐直了。", kind: "recovery", rarity: "common", weight: 1 },
  { id: "drink_together", name: "共饮", icon: "🍻", tone: "amber", desc: "双方同时喝 3 杯。", flavor: "杯子一撞，谁也别想独善其身。", kind: "chaos", rarity: "common", weight: 0.9 },
  { id: "pass_the_cup", name: "甩锅", icon: "🥴", tone: "brick", desc: "你少喝默认那 1 杯，对手替你喝 1 杯。", flavor: "逻辑不重要，重要的是把杯子推过去。", kind: "trick", rarity: "common", weight: 1 },
  { id: "counter_toast", name: "反手敬酒", icon: "🍶", tone: "ink", desc: "若对方本回合让你喝酒，挡回 1 杯给对方。", flavor: "这杯我敬回去，主打一个礼尚往来。", kind: "trick", rarity: "common", weight: 1 }
];

const CHARACTER_DEFS = {
  zhongju: {
    id: "zhongju",
    shortLabel: "权",
    name: "钟局",
    title: "官腔一开，酒杯自动排队",
    tagline: "居酒屋规则制定者",
    quote: "这杯不算罚酒，算工作交流。",
    special: { id: "authority", name: "权力", icon: "📣", desc: "本回合强迫对手多喝 2 杯。", flavor: "一拍桌子，酒桌空气都开始写报告。" }
  },
  bingwang: {
    id: "bingwang",
    shortLabel: "兵",
    name: "兵王",
    title: "站得像标枪，喝得像开挂",
    tagline: "军旅硬汉型拼酒王",
    quote: "报告，杯子可以空，气势不能垮。",
    special: { id: "wine_god", name: "酒神附体", icon: "🔥", desc: "从本回合起连续 3 回合，你的酒醉度结算减半。", flavor: "眼神一变，连酒精都想立正敬礼。" }
  },
  yueyueniao: {
    id: "yueyueniao",
    shortLabel: "鸟",
    name: "月月鸟哥",
    title: "嘴上社牛，脚下逃酒路线专家",
    tagline: "表情包型社交达人",
    quote: "先别敬，我去个洗手间回来再讲段子。",
    special: { id: "toilet_break", name: "上厕所", icon: "🏃", desc: "下个回合你喝的酒不产生酒醉度。", flavor: "转身就跑，回头还要假装真有急事。" }
  }
};

const uiState = {
  screen: "select",
  gameState: null,
  busy: false,
  busyText: "",
  audioEnabled: false
};

let audioContextRef = null;
let musicIntervalRef = null;
let musicStepRef = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFromList(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function drawWeightedCards(pool, count) {
  const source = pool.map((card) => clone(card));
  const picked = [];
  while (source.length && picked.length < count) {
    const totalWeight = source.reduce((sum, card) => sum + (card.weight || 1), 0);
    let hit = Math.random() * totalWeight;
    let pickIndex = 0;
    for (let i = 0; i < source.length; i += 1) {
      hit -= source[i].weight || 1;
      if (hit <= 0) {
        pickIndex = i;
        break;
      }
    }
    picked.push(source.splice(pickIndex, 1)[0]);
  }
  return picked;
}

function drawCards(count) {
  return drawWeightedCards(CARD_POOL, count);
}

function createLog(text, round, id) {
  return { id, round, text };
}

function pushLog(state, text, round) {
  state.logSeq += 1;
  state.logs.push(createLog(text, round, state.logSeq));
  if (state.logs.length > LOG_LIMIT) {
    state.logs = state.logs.slice(state.logs.length - LOG_LIMIT);
  }
}

function buildFighter(characterId, side) {
  const source = clone(CHARACTER_DEFS[characterId]);
  return {
    id: source.id,
    side,
    shortLabel: source.shortLabel,
    name: source.name,
    title: source.title,
    tagline: source.tagline,
    quote: source.quote,
    drunkness: 0,
    maxDrunkness: MAX_DRUNK,
    pose: "idle",
    poseLabel: "",
    statusText: "状态稳定",
    tags: [],
    avatarClass: "",
    drunkPercent: 0,
    fillClass: "",
    specialButtonClass: "",
    specialButtonText: "",
    special: {
      id: source.special.id,
      name: source.special.name,
      icon: source.special.icon,
      desc: source.special.desc,
      flavor: source.special.flavor,
      usesLeft: 1
    },
    status: {
      ignoreForcedNextRound: false,
      halfEffectRounds: 0,
      zeroNextRound: false
    }
  };
}

function createSelectionRoster() {
  return Object.keys(CHARACTER_DEFS).map((id) => {
    const item = CHARACTER_DEFS[id];
    return {
      id: item.id,
      shortLabel: item.shortLabel,
      name: item.name,
      title: item.title,
      tagline: item.tagline,
      quote: item.quote,
      special: clone(item.special),
      rosterClass: `avatar-${item.id} pose-idle tipsy-fresh`
    };
  });
}

function createCardLibrary() {
  return CARD_POOL.map((card) => clone(card));
}

function getAudioContext() {
  if (!audioContextRef) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContextRef = new AudioCtx();
  }
  return audioContextRef;
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

function playTone(ctx, frequency, duration, options = {}) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(options.volume || 0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function playNoiseBurst(ctx, duration = 0.12, volume = 0.025) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = ctx.createBufferSource();
  const gain = ctx.createGain();
  noise.buffer = buffer;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  noise.connect(gain);
  gain.connect(ctx.destination);
  noise.start(ctx.currentTime);
}

function playGulp(ctx, cups = 1, startOffset = 0) {
  const swallows = Math.max(1, Math.min(4, cups));
  for (let i = 0; i < swallows; i += 1) {
    const at = ctx.currentTime + startOffset + i * 0.13;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, at);
    osc.frequency.exponentialRampToValueAtTime(150, at + 0.11);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.05, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.12);
  }
}

function playCupClink(ctx, startOffset = 0) {
  playTone(ctx, 1280, 0.05, { type: "triangle", volume: 0.018 });
  playTone(ctx, 1760, 0.04, { type: "sine", volume: 0.012 });
  playNoiseBurst(ctx, 0.03, 0.008 + startOffset * 0);
}

function playShoutHe(ctx, startOffset = 0) {
  const at = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(520, at);
  osc.frequency.exponentialRampToValueAtTime(280, at + 0.16);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.028, at + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.18);
}

function startMusicLoop() {
  const ctx = getAudioContext();
  if (!ctx || musicIntervalRef) return;
  const notes = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 392.0, 440.0];
  musicStepRef = 0;
  musicIntervalRef = window.setInterval(() => {
    if (!uiState.audioEnabled) return;
    const base = notes[musicStepRef % notes.length];
    playTone(ctx, base, 0.28, { type: "triangle", volume: 0.028 });
    playTone(ctx, base / 2, 0.34, { type: "sine", volume: 0.016 });
    if (musicStepRef % 2 === 0) {
      playNoiseBurst(ctx, 0.06, 0.012);
    }
    musicStepRef += 1;
  }, 420);
}

function stopMusicLoop() {
  if (musicIntervalRef) {
    window.clearInterval(musicIntervalRef);
    musicIntervalRef = null;
  }
}

async function setAudioEnabled(enabled) {
  uiState.audioEnabled = enabled;
  const ctx = await ensureAudioReady();
  if (!ctx) {
    uiState.audioEnabled = false;
    render();
    return;
  }
  if (enabled) {
    startMusicLoop();
    playTone(ctx, 523.25, 0.2, { type: "triangle", volume: 0.06 });
    playTone(ctx, 659.25, 0.24, { type: "triangle", volume: 0.045 });
  } else {
    stopMusicLoop();
  }
  render();
}

async function toggleAudio() {
  await setAudioEnabled(!uiState.audioEnabled);
}

async function playSfx(kind) {
  if (!uiState.audioEnabled) return;
  const ctx = await ensureAudioReady();
  if (!ctx) return;
  if (kind === "card") {
    playTone(ctx, 620, 0.12, { type: "square", volume: 0.035 });
    playTone(ctx, 860, 0.08, { type: "triangle", volume: 0.02 });
  } else if (kind === "special") {
    playTone(ctx, 392, 0.22, { type: "sawtooth", volume: 0.05 });
    playTone(ctx, 523.25, 0.28, { type: "triangle", volume: 0.03 });
  } else if (kind === "select") {
    playTone(ctx, 392, 0.18, { type: "triangle", volume: 0.04 });
    playTone(ctx, 493.88, 0.2, { type: "triangle", volume: 0.032 });
  } else if (kind === "win") {
    playTone(ctx, 523.25, 0.2, { type: "triangle", volume: 0.055 });
    playTone(ctx, 659.25, 0.25, { type: "triangle", volume: 0.045 });
    playTone(ctx, 783.99, 0.32, { type: "triangle", volume: 0.04 });
  } else if (kind === "lose") {
    playTone(ctx, 330, 0.22, { type: "sine", volume: 0.045 });
    playTone(ctx, 246.94, 0.3, { type: "sine", volume: 0.035 });
  } else if (kind === "drink") {
    playGulp(ctx, 2, 0);
    playShoutHe(ctx, 0.04);
  } else if (kind === "drink-heavy") {
    playCupClink(ctx, 0);
    playGulp(ctx, 4, 0.03);
    playShoutHe(ctx, 0.02);
  } else if (kind === "boost") {
    playTone(ctx, 440, 0.12, { type: "square", volume: 0.03 });
    playTone(ctx, 554.37, 0.14, { type: "triangle", volume: 0.026 });
    playTone(ctx, 659.25, 0.18, { type: "triangle", volume: 0.024 });
  } else if (kind === "recovery") {
    playTone(ctx, 392, 0.12, { type: "sine", volume: 0.025 });
    playTone(ctx, 523.25, 0.16, { type: "triangle", volume: 0.02 });
  }
}

function createBattle(playerId) {
  const enemyOptions = Object.keys(CHARACTER_DEFS).filter((id) => id !== playerId);
  const enemyId = randomFromList(enemyOptions);
  const state = {
    stage: "battle",
    round: 1,
    player: buildFighter(playerId, "player"),
    enemy: buildFighter(enemyId, "enemy"),
    playerHand: drawCards(HAND_SIZE),
    enemyHand: drawCards(HAND_SIZE),
    logs: [],
    logSeq: 0,
    roundBanner: "",
    lastRound: {
      summary: "纸灯笼刚亮起来，第一轮先碰杯再斗法。",
      playerActionText: "你还没出牌",
      enemyActionText: "对面还在抖包袱",
      playerCupText: "0 杯 / +0",
      enemyCupText: "0 杯 / +0"
    },
    result: null
  };
  pushLog(state, `${state.player.name}推门进店，今夜对手是${state.enemy.name}。`, 0);
  pushLog(state, "老板把酒盅一摆：每回合双方默认都得先喝 1 杯。", 0);
  state.roundBanner = `${state.enemy.name}已经坐下，灯笼一晃，第一回合开喝。`;
  return decorateState(state);
}

function chooseEnemyAction(state) {
  const actor = state.enemy;
  const target = state.player;

  if (actor.special.usesLeft > 0) {
    if (actor.id === "zhongju" && !target.status.ignoreForcedNextRound && (target.drunkness >= 52 || state.round >= 3)) {
      return { type: "special" };
    }
    if (actor.id === "bingwang" && actor.drunkness >= 36) {
      return { type: "special" };
    }
    if (actor.id === "yueyueniao" && actor.drunkness >= 50) {
      return { type: "special" };
    }
  }

  let bestScore = -9999;
  let bestIndex = 0;
  state.enemyHand.forEach((card, index) => {
    let score = Math.random() * 1.5;
    const targetShieldActive = !!target.status.ignoreForcedNextRound;

    switch (card.id) {
      case "pretend_drunk":
        score += actor.drunkness >= 48 ? 13 : 4;
        break;
      case "flatter":
        score += targetShieldActive ? 1 : 16 + target.drunkness / 8;
        break;
      case "dilute":
        score += actor.drunkness >= 38 ? 12 : 5;
        break;
      case "raise_fish":
        score += actor.drunkness >= 32 ? 10 : 4;
        break;
      case "water_as_wine":
        score += actor.drunkness >= 56 ? 18 : 7;
        break;
      case "red_bull":
        score += actor.special.usesLeft <= 0 ? 18 : 8;
        score += actor.drunkness >= 42 ? 5 : 0;
        break;
      case "snack_guard":
        score += actor.drunkness >= 54 ? 17 : 5;
        break;
      case "drink_together":
        score += target.drunkness > actor.drunkness ? 15 : 4;
        score += target.drunkness >= 68 ? 7 : 0;
        score -= actor.drunkness >= 74 ? 8 : 0;
        break;
      case "pass_the_cup":
        score += targetShieldActive ? 2 : 12 + actor.drunkness / 12;
        break;
      case "counter_toast":
        score += target.id === "zhongju" ? 14 : 8;
        score += target.drunkness > actor.drunkness ? 3 : 0;
        break;
      default:
        score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return { type: "card", cardIndex: bestIndex };
}

function createRoundContext(fighter) {
  return {
    baseCups: 1,
    forcedByOpponent: 0,
    effectMultiplier: 1,
    zeroDrunk: false,
    relief: 0,
    returnOneForced: false,
    ignoreForcedThisRound: !!fighter.status.ignoreForcedNextRound,
    setIgnoreForcedNextRound: false,
    setZeroNextRound: false,
    persistHalfRounds: 0,
    extraSpecialUse: 0,
    pose: "idle",
    poseLabel: ""
  };
}

function buildActionFromChoice(state, side, choice) {
  const fighter = side === "player" ? state.player : state.enemy;
  const hand = side === "player" ? state.playerHand : state.enemyHand;

  if (choice.type === "special") {
    return {
      type: "special",
      id: fighter.special.id,
      name: fighter.special.name,
      icon: fighter.special.icon,
      desc: fighter.special.desc,
      flavor: fighter.special.flavor
    };
  }

  const safeIndex = typeof choice.cardIndex === "number" ? choice.cardIndex : 0;
  return clone(hand[safeIndex] || hand[0]);
}

function applyAction(actor, target, action, selfRound, targetRound, state, roundNumber) {
  pushLog(state, `${actor.name}亮出${action.type === "special" ? "绝活" : "技能卡"}【${action.name}】。`, roundNumber);

  switch (action.id) {
    case "pretend_drunk":
      selfRound.setIgnoreForcedNextRound = true;
      selfRound.pose = "nap";
      selfRound.poseLabel = "ZZZ";
      pushLog(state, `${actor.name}啪地趴桌，先把下回合的灌酒额度躲起来。`, roundNumber);
      break;
    case "flatter":
      targetRound.forcedByOpponent += 1;
      selfRound.pose = "toast";
      selfRound.poseLabel = "敬";
      pushLog(state, `${actor.name}一顿猛夸，把${target.name}夸得多喝 1 杯。`, roundNumber);
      break;
    case "dilute":
      selfRound.effectMultiplier *= 0.5;
      selfRound.pose = "water";
      selfRound.poseLabel = "兑";
      pushLog(state, `${actor.name}偷偷掺水，本回合酒劲直接砍半。`, roundNumber);
      break;
    case "raise_fish":
      selfRound.effectMultiplier *= 0.75;
      selfRound.pose = "fish";
      selfRound.poseLabel = "鱼";
      pushLog(state, `${actor.name}开启养鱼模式，这回合只吃 75% 酒劲。`, roundNumber);
      break;
    case "water_as_wine":
      selfRound.zeroDrunk = true;
      selfRound.pose = "smirk";
      selfRound.poseLabel = "水";
      pushLog(state, `${actor.name}一本正经指水为酒，这回合酒醉度清零结算。`, roundNumber);
      break;
    case "red_bull":
      selfRound.extraSpecialUse += 1;
      selfRound.pose = "god";
      selfRound.poseLabel = "牛";
      pushLog(state, `${actor.name}吨吨灌下红牛，硬是给自己续了 1 次绝活机会。`, roundNumber);
      break;
    case "snack_guard":
      selfRound.relief += 12;
      selfRound.pose = "eat";
      selfRound.poseLabel = "串";
      pushLog(state, `${actor.name}抓起下酒菜猛炫，立刻回落 12 点酒醉度。`, roundNumber);
      break;
    case "drink_together":
      selfRound.baseCups += 2;
      targetRound.baseCups += 2;
      selfRound.pose = "toast";
      selfRound.poseLabel = "共饮";
      pushLog(state, `${actor.name}拉着${target.name}共饮，这回合双方都各自多喝 3 杯。`, roundNumber);
      break;
    case "pass_the_cup":
      selfRound.baseCups = Math.max(0, selfRound.baseCups - 1);
      targetRound.forcedByOpponent += 1;
      selfRound.pose = "shrug";
      selfRound.poseLabel = "甩";
      pushLog(state, `${actor.name}把默认那杯顺手甩锅给了${target.name}。`, roundNumber);
      break;
    case "counter_toast":
      selfRound.returnOneForced = true;
      selfRound.pose = "snap";
      selfRound.poseLabel = "敬回";
      pushLog(state, `${actor.name}把酒盅捏在手里，准备反手敬回去。`, roundNumber);
      break;
    case "authority":
      targetRound.forcedByOpponent += 2;
      selfRound.pose = "command";
      selfRound.poseLabel = "压";
      pushLog(state, `${actor.name}发动绝活【权力】，强行加码 2 杯。`, roundNumber);
      break;
    case "wine_god":
      selfRound.effectMultiplier *= 0.5;
      selfRound.persistHalfRounds = 2;
      selfRound.pose = "god";
      selfRound.poseLabel = "神";
      pushLog(state, `${actor.name}发动绝活【酒神附体】，从本回合起连续 3 回合酒劲减半。`, roundNumber);
      break;
    case "toilet_break":
      selfRound.setZeroNextRound = true;
      selfRound.pose = "run";
      selfRound.poseLabel = "WC";
      pushLog(state, `${actor.name}发动绝活【上厕所】，先把下回合整成免醉档。`, roundNumber);
      break;
    default:
      break;
  }
}

function resolveCounterToasts(player, enemy, playerRound, enemyRound, state, roundNumber) {
  if (playerRound.returnOneForced && playerRound.forcedByOpponent > 0) {
    playerRound.forcedByOpponent -= 1;
    enemyRound.forcedByOpponent += 1;
    pushLog(state, `${player.name}把 1 杯灌酒反手敬回给了${enemy.name}。`, roundNumber);
  }
  if (enemyRound.returnOneForced && enemyRound.forcedByOpponent > 0) {
    enemyRound.forcedByOpponent -= 1;
    playerRound.forcedByOpponent += 1;
    pushLog(state, `${enemy.name}把 1 杯灌酒原路弹回给了${player.name}。`, roundNumber);
  }
}

function resolveProtection(fighter, roundCtx, state, roundNumber) {
  if (roundCtx.ignoreForcedThisRound && roundCtx.forcedByOpponent > 0) {
    const blocked = roundCtx.forcedByOpponent;
    roundCtx.forcedByOpponent = 0;
    pushLog(state, `${fighter.name}的装醉保护生效，躲掉了 ${blocked} 杯灌酒。`, roundNumber);
  }
}

function settlePersistentStatus(fighter, roundCtx) {
  if (fighter.status.ignoreForcedNextRound) fighter.status.ignoreForcedNextRound = false;
  if (roundCtx.setIgnoreForcedNextRound) fighter.status.ignoreForcedNextRound = true;

  if (fighter.status.zeroNextRound) fighter.status.zeroNextRound = false;
  if (roundCtx.setZeroNextRound) fighter.status.zeroNextRound = true;

  if (fighter.status.halfEffectRounds > 0) fighter.status.halfEffectRounds -= 1;
  if (roundCtx.persistHalfRounds > 0) {
    fighter.status.halfEffectRounds = Math.max(fighter.status.halfEffectRounds, roundCtx.persistHalfRounds);
  }

  if (roundCtx.extraSpecialUse > 0) {
    fighter.special.usesLeft += roundCtx.extraSpecialUse;
  }
}

function calculateGain(fighter, roundCtx) {
  const soberBase = clamp(fighter.drunkness - roundCtx.relief, 0, fighter.maxDrunkness);
  const totalCups = Math.max(0, roundCtx.baseCups + roundCtx.forcedByOpponent);
  const gain = roundCtx.zeroDrunk ? 0 : Math.round(totalCups * BASE_DRUNK_PER_CUP * roundCtx.effectMultiplier);
  fighter.drunkness = clamp(soberBase + gain, 0, fighter.maxDrunkness);
  fighter.pose = roundCtx.pose;
  fighter.poseLabel = roundCtx.poseLabel;
  return { totalCups, gain };
}

function buildResult(player, enemy, roundNumber) {
  if (player.drunkness >= MAX_DRUNK && enemy.drunkness >= MAX_DRUNK) {
    return { title: "双双趴桌", desc: `第 ${roundNumber} 回合结束后两边一起醉倒，老板已经开始搬电风扇。` };
  }
  if (enemy.drunkness >= MAX_DRUNK) {
    return { title: "你把对面喝趴了", desc: `${enemy.name}在第 ${roundNumber} 回合先到满格酒醉度，你赢下了这桌。` };
  }
  return { title: "你先被抬去吹风了", desc: `第 ${roundNumber} 回合结束后你的酒醉度先爆表，老板建议你去门口醒醒酒。` };
}

function buildRoundBanner(player, enemy) {
  if (player.drunkness >= MAX_DRUNK || enemy.drunkness >= MAX_DRUNK) return "酒盅已经见底，今晚这桌胜负已分。";
  if (Math.abs(player.drunkness - enemy.drunkness) <= 10) return "两边都在强撑体面，空气里全是嘴硬。";
  if (player.drunkness < enemy.drunkness) return `${player.name}明显更稳，${enemy.name}的眼神开始飘了。`;
  return `${enemy.name}目前更稳，${player.name}正在努力装没事。`;
}

function decorateFighter(fighter) {
  const tags = [];
  if (fighter.status.ignoreForcedNextRound) tags.push("下回合免灌");
  if (fighter.status.halfEffectRounds > 0) tags.push(`酒神剩 ${fighter.status.halfEffectRounds} 回合`);
  if (fighter.status.zeroNextRound) tags.push("下回合免醉");

  let tipsyClass = "tipsy-fresh";
  let statusText = "状态稳定";
  if (fighter.drunkness >= 85) {
    tipsyClass = "tipsy-ko";
    statusText = "快趴桌了";
  } else if (fighter.drunkness >= 60) {
    tipsyClass = "tipsy-wobble";
    statusText = "开始打晃";
  } else if (fighter.drunkness >= 30) {
    tipsyClass = "tipsy-warm";
    statusText = "微醺上脸";
  }

  fighter.drunkPercent = Math.round((fighter.drunkness / fighter.maxDrunkness) * 100);
  fighter.tags = tags;
  fighter.statusText = statusText;
  fighter.avatarClass = `avatar-${fighter.id} pose-${fighter.pose} ${tipsyClass}`;
  fighter.fillClass = fighter.side === "player" ? "player-fill" : "enemy-fill";
  fighter.specialButtonClass = fighter.special.usesLeft <= 0 ? "disabled" : "";
  fighter.specialButtonText = fighter.special.usesLeft <= 0
    ? "绝活已用完"
    : `发动绝活：${fighter.special.name}（剩 ${fighter.special.usesLeft} 次）`;
}

function decorateState(state) {
  decorateFighter(state.player);
  decorateFighter(state.enemy);
  if (state.stage === "result") {
    const isDraw = state.player.drunkness >= MAX_DRUNK && state.enemy.drunkness >= MAX_DRUNK;
    if (!isDraw) {
      const playerWon = state.enemy.drunkness >= MAX_DRUNK;
      state.player.avatarClass += playerWon ? " result-winner" : " result-loser";
      state.enemy.avatarClass += playerWon ? " result-loser" : " result-winner";
      if (playerWon) {
        state.player.poseLabel = "庆";
        state.enemy.poseLabel = "晕";
      } else {
        state.player.poseLabel = "晕";
        state.enemy.poseLabel = "庆";
      }
    } else {
      state.player.avatarClass += " result-loser";
      state.enemy.avatarClass += " result-loser";
      state.player.poseLabel = "晕";
      state.enemy.poseLabel = "晕";
    }
  }
  state.roundBanner = state.roundBanner || buildRoundBanner(state.player, state.enemy);
  return state;
}

function playRound(prevState, playerChoice) {
  const state = clone(prevState);
  const roundNumber = state.round;
  const enemyChoice = chooseEnemyAction(state);
  const playerAction = buildActionFromChoice(state, "player", playerChoice);
  const enemyAction = buildActionFromChoice(state, "enemy", enemyChoice);
  const playerRound = createRoundContext(state.player);
  const enemyRound = createRoundContext(state.enemy);

  if (state.player.status.halfEffectRounds > 0) playerRound.effectMultiplier *= 0.5;
  if (state.enemy.status.halfEffectRounds > 0) enemyRound.effectMultiplier *= 0.5;
  if (state.player.status.zeroNextRound) playerRound.zeroDrunk = true;
  if (state.enemy.status.zeroNextRound) enemyRound.zeroDrunk = true;
  if (playerChoice.type === "special") state.player.special.usesLeft = Math.max(0, state.player.special.usesLeft - 1);
  if (enemyChoice.type === "special") state.enemy.special.usesLeft = Math.max(0, state.enemy.special.usesLeft - 1);

  pushLog(state, `第 ${roundNumber} 回合开喝：双方先端起默认那一杯。`, roundNumber);
  applyAction(state.player, state.enemy, playerAction, playerRound, enemyRound, state, roundNumber);
  applyAction(state.enemy, state.player, enemyAction, enemyRound, playerRound, state, roundNumber);
  resolveCounterToasts(state.player, state.enemy, playerRound, enemyRound, state, roundNumber);
  resolveProtection(state.player, playerRound, state, roundNumber);
  resolveProtection(state.enemy, enemyRound, state, roundNumber);

  const playerGain = calculateGain(state.player, playerRound);
  const enemyGain = calculateGain(state.enemy, enemyRound);

  settlePersistentStatus(state.player, playerRound);
  settlePersistentStatus(state.enemy, enemyRound);

  state.lastRound = {
    summary: `${state.player.name}使出【${playerAction.name}】，${state.enemy.name}应对【${enemyAction.name}】。`,
    playerActionText: `你出：${playerAction.name}`,
    enemyActionText: `对手出：${enemyAction.name}`,
    playerCupText: `${playerGain.totalCups} 杯 / +${playerGain.gain}`,
    enemyCupText: `${enemyGain.totalCups} 杯 / +${enemyGain.gain}`,
    playerCups: playerGain.totalCups,
    enemyCups: enemyGain.totalCups
  };

  pushLog(state, `${state.player.name}本回合喝了 ${playerGain.totalCups} 杯，酒醉度来到 ${state.player.drunkness}。${state.enemy.name}喝了 ${enemyGain.totalCups} 杯，酒醉度来到 ${state.enemy.drunkness}。`, roundNumber);

  if (state.player.drunkness >= MAX_DRUNK || state.enemy.drunkness >= MAX_DRUNK) {
    state.stage = "result";
    state.result = buildResult(state.player, state.enemy, roundNumber);
    state.roundBanner = state.result.desc;
    pushLog(state, `${state.result.title}。`, roundNumber);
    return decorateState(state);
  }

  state.round += 1;
  state.playerHand = drawCards(HAND_SIZE);
  state.enemyHand = drawCards(HAND_SIZE);
  state.roundBanner = buildRoundBanner(state.player, state.enemy);
  return decorateState(state);
}

function getBusyText(enemy) {
  const map = {
    zhongju: "钟局正在扶眼镜、抖官腔、准备发话……",
    bingwang: "兵王正在抻肩膀，像是要把酒精训话……",
    yueyueniao: "月月鸟哥正在左右看路，像在找新借口……"
  };
  return map[enemy.id] || "对手正在端杯子组织语言……";
}

function avatarMarkup(className, poseLabel, mini = false) {
  return `
    <div class="avatar ${mini ? "mini " : ""}${className}">
      <div class="avatar-shadow"></div>
      <div class="avatar-body"></div>
      <div class="avatar-body-detail"></div>
      <div class="avatar-jacket left"></div>
      <div class="avatar-jacket right"></div>
      <div class="avatar-collar left"></div>
      <div class="avatar-collar right"></div>
      <div class="avatar-tie"></div>
      <div class="avatar-badge"></div>
      <div class="avatar-sash"></div>
      <div class="avatar-arm left"></div>
      <div class="avatar-arm right"></div>
      <div class="avatar-prop main"></div>
      <div class="avatar-prop alt"></div>
      <div class="avatar-head">
        <div class="avatar-hair"></div>
        <div class="avatar-brow left"></div>
        <div class="avatar-brow right"></div>
        <div class="avatar-eye left"></div>
        <div class="avatar-eye right"></div>
        <div class="avatar-cheek left"></div>
        <div class="avatar-cheek right"></div>
        <div class="avatar-mouth"></div>
      </div>
      ${poseLabel ? `<div class="pose-sign">${poseLabel}</div>` : ""}
    </div>
  `;
}

function renderSelectScreen() {
  const roster = createSelectionRoster();
  const cards = createCardLibrary();
  return `
    <section>
      <div class="hero-banner">
        <img class="hero-icon" src="./assets/icon-jiuwu-dazhan.png" alt="酒屋大战图标">
        <div>
          <div class="hero-chip">居酒屋回合战</div>
          <div class="hero-title">酒屋大战</div>
          <div class="hero-subtitle">选一个酒桌狠人开局。每回合默认喝 1 杯，靠技能卡少喝、让对手多喝，谁先醉倒谁输。</div>
          <div class="hero-actions">
            <button class="sound-btn" data-action="toggle-audio">${uiState.audioEnabled ? "音乐已开" : "点我开音乐"}</button>
            <span class="audio-pill">${uiState.audioEnabled ? "背景乐 + 音效开启" : "微信里首次点一下即可启用声音"}</span>
          </div>
        </div>
      </div>

      <div class="rule-strip">
        <div class="rule-pill">每回合双方默认喝 1 杯</div>
        <div class="rule-pill">随机抽 3 张技能卡</div>
        <div class="rule-pill">角色绝活每局 1 次</div>
        <div class="rule-pill">酒醉度满 100 就晕</div>
      </div>

      <div class="roster">
        ${roster.map((item) => `
          <article class="roster-card">
            <div class="roster-stamp">${item.shortLabel}</div>
            <div class="mini-stage">${avatarMarkup(item.rosterClass, "", true)}</div>
            <div class="roster-name">${item.name}</div>
            <div class="roster-title">${item.title}</div>
            <div class="roster-tagline">${item.tagline}</div>
            <div class="special-card">
              <div class="special-name">${item.special.icon} ${item.special.name}</div>
              <div class="special-desc">${item.special.desc}</div>
            </div>
            <div class="roster-quote">“${item.quote}”</div>
            <button class="pick-btn" data-action="select-character" data-character="${item.id}">选他开喝</button>
          </article>
        `).join("")}
      </div>

      <section class="catalog-board">
        <div class="catalog-title">酒桌套路册</div>
        <div class="catalog-list">
          ${cards.map((card) => `
            <div class="catalog-card tone-${card.tone}">
              <div class="catalog-icon">${card.icon}</div>
              <div>
                <div class="catalog-name-row">
                  <div class="catalog-name">${card.name}</div>
                  ${card.rarity === "rare" ? `<span class="rarity-badge">稀有</span>` : ""}
                </div>
                <div class="catalog-desc">${card.desc}</div>
                <div class="catalog-flavor">${card.flavor}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function fighterPanelMarkup(fighter) {
  return `
    <div class="fighter-panel">
      <div class="meter-card">
        <div class="meter-top">
          <div class="meter-name">${fighter.name}</div>
          <div class="meter-num">${fighter.drunkness} / ${fighter.maxDrunkness}</div>
        </div>
        <div class="meter-label">酒醉度</div>
        <div class="meter-track"><div class="meter-fill ${fighter.fillClass}" style="width:${fighter.drunkPercent}%"></div></div>
      </div>
      <div class="stage-box">${avatarMarkup(fighter.avatarClass, fighter.poseLabel)}</div>
      <div class="fighter-title">${fighter.title}</div>
      <div class="status-row">
        ${(fighter.tags.length ? fighter.tags : [fighter.statusText]).map((tag, index) => `<span class="status-chip ${fighter.tags.length ? "" : "muted"}" key="${index}">${tag}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderBattleScreen() {
  const state = uiState.gameState;
  const isResult = state.stage === "result";
  return `
    <section>
      <div class="battle-header">
        <div>
          <div class="battle-title">酒屋大战</div>
          <div class="battle-subtitle">${state.player.name} VS ${state.enemy.name}</div>
        </div>
        <div class="battle-header-side">
          <button class="sound-btn small" data-action="toggle-audio">${uiState.audioEnabled ? "关音乐" : "开音乐"}</button>
          <div class="round-lamp">第 ${state.round} 回合</div>
        </div>
      </div>

      <div class="banner-board">${state.roundBanner}</div>

      <div class="arena">
        <div class="noren left"></div>
        <div class="noren right"></div>
        <div class="backroom-glow"></div>
        <div class="backroom-lamp lamp-left"></div>
        <div class="backroom-lamp lamp-mid"></div>
        <div class="backroom-lamp lamp-right"></div>
        <div class="backroom-table table-left"></div>
        <div class="backroom-table table-mid"></div>
        <div class="backroom-table table-right"></div>
        <div class="backroom-guest guest-left"></div>
        <div class="backroom-guest guest-mid"></div>
        <div class="backroom-guest guest-right"></div>
        <div class="izakaya-decor menu-left">今日串烧</div>
        <div class="izakaya-decor menu-right">清酒热卖</div>
        <div class="izakaya-sticker sticker-left">酒</div>
        <div class="izakaya-sticker sticker-right">笑</div>
        <div class="table-line"></div>

        <div class="fighters-row">
          ${fighterPanelMarkup(state.player)}
          <div class="center-board">
            <div class="sake-bottle">
              <div class="sake-cap"></div>
              <div class="sake-label">本回合战报</div>
              <div class="sake-summary">${state.lastRound.summary}</div>
            </div>
            <div class="round-sheet">
              <div class="sheet-line">${state.lastRound.playerActionText}</div>
              <div class="sheet-line">${state.lastRound.enemyActionText}</div>
              <div class="sheet-line">你：${state.lastRound.playerCupText}</div>
              <div class="sheet-line">对手：${state.lastRound.enemyCupText}</div>
            </div>
          </div>
          ${fighterPanelMarkup(state.enemy)}
        </div>
      </div>

      ${!isResult ? `
        <section class="action-board">
          <div class="action-head">
            <div class="action-meta">
              <div class="action-title">本回合抽到的技能卡</div>
              <div class="special-callout">
                <div class="special-callout-label">本角绝活</div>
                <div class="special-callout-name">${state.player.special.icon} ${state.player.special.name}</div>
                <div class="special-callout-desc">${state.player.special.desc}</div>
                <div class="special-callout-flavor">${state.player.special.flavor}</div>
              </div>
            </div>
            <button class="special-btn ${state.player.specialButtonClass}" data-action="use-special" ${uiState.busy || state.player.special.usesLeft <= 0 ? "disabled" : ""}>${state.player.specialButtonText}</button>
          </div>
          ${uiState.busy ? `<div class="busy-strip">${uiState.busyText}</div>` : ""}
          <div class="hand-grid">
            ${state.playerHand.map((card, index) => `
              <button class="card-btn tone-${card.tone}" data-action="use-card" data-index="${index}" ${uiState.busy ? "disabled" : ""}>
                <div class="skill-icon">${card.icon}</div>
                <div class="skill-copy">
                  <div class="skill-name-row">
                    <div class="skill-name">${card.name}</div>
                    ${card.rarity === "rare" ? `<span class="rarity-badge">稀有</span>` : ""}
                  </div>
                  <div class="catalog-desc">${card.desc}</div>
                  <div class="catalog-flavor">${card.flavor}</div>
                </div>
              </button>
            `).join("")}
          </div>
        </section>
      ` : `
        <section class="result-panel">
          <div class="result-title">${state.result.title}</div>
          <div class="result-desc">${state.result.desc}</div>
          <div class="result-actions">
            <button class="restart-btn" data-action="restart">同角色再来一局</button>
            <button class="back-btn" data-action="back-select">返回换人</button>
          </div>
        </section>
      `}

      <section class="log-card">
        <div class="log-head">纸灯笼战报</div>
        <div class="log-scroll">
          ${state.logs.map((log) => `
            <div class="log-item">
              <div class="log-round">R${log.round}</div>
              <div class="log-text">${log.text}</div>
            </div>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function render() {
  const root = document.getElementById("app");
  root.innerHTML = uiState.screen === "select" ? renderSelectScreen() : renderBattleScreen();
}

function startBattle(characterId) {
  uiState.gameState = createBattle(characterId);
  uiState.screen = "battle";
  uiState.busy = false;
  uiState.busyText = "";
  render();
  playSfx("select");
}

function restartBattle() {
  startBattle(uiState.gameState.player.id);
}

function backToSelect() {
  uiState.screen = "select";
  uiState.gameState = null;
  uiState.busy = false;
  uiState.busyText = "";
  render();
}

function resolveRound(choice) {
  if (!uiState.gameState || uiState.busy || uiState.gameState.stage !== "battle") return;
  uiState.busy = true;
  uiState.busyText = getBusyText(uiState.gameState.enemy);
  const selectedCard = choice.type === "card" ? uiState.gameState.playerHand[choice.cardIndex] : null;
  playSfx(choice.type === "special" ? "special" : sfxKindForCard(selectedCard));
  render();

  setTimeout(() => {
    uiState.gameState = playRound(uiState.gameState, choice);
    uiState.busy = false;
    uiState.busyText = "";
    render();
    if (uiState.gameState?.lastRound) {
      const totalCups = (uiState.gameState.lastRound.playerCups || 0) + (uiState.gameState.lastRound.enemyCups || 0);
      playSfx(totalCups >= 4 ? "drink-heavy" : "drink");
    }
    if (uiState.gameState.stage === "result") {
      playSfx(uiState.gameState.result.title === "你把对面喝趴了" ? "win" : "lose");
    }
    const logScroll = document.querySelector(".log-scroll");
    if (logScroll) logScroll.scrollTop = logScroll.scrollHeight;
  }, 420);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action } = target.dataset;
  if (action === "toggle-audio") toggleAudio();
  if (action === "select-character") startBattle(target.dataset.character);
  if (action === "use-card") resolveRound({ type: "card", cardIndex: Number(target.dataset.index) });
  if (action === "use-special") resolveRound({ type: "special" });
  if (action === "restart") restartBattle();
  if (action === "back-select") backToSelect();
});

function sfxKindForCard(card) {
  if (!card) return "card";
  if (card.id === "red_bull") return "boost";
  if (card.id === "snack_guard") return "recovery";
  return "card";
}

render();
