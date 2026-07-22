import type { CompanionDefinition, CompanionMotionKey, CompanionStageDefinition, CompanionStageKey } from "./companion-types";

const STRONG_BUNNY_ROOT = "/companions/strong-bunny";
const MOTION_KEYS: CompanionMotionKey[] = [
  "idle", "rest", "celebrate", "recover", "horizontal_push", "vertical_push",
  "horizontal_pull", "vertical_pull", "squat", "hinge", "lunge", "arm_isolation",
  "dynamic_core", "static_core", "cardio", "mobility",
];

function strongBunnyMotionAssets(stage: CompanionStageKey) {
  return Object.fromEntries(MOTION_KEYS.map((motion) => [motion, `${STRONG_BUNNY_ROOT}/motions/${stage}/${motion}.webp`])) as Record<CompanionMotionKey, string>;
}

function strongBunnyStage(
  base: CompanionStageDefinition,
  description: string,
): CompanionStageDefinition {
  const stageRoot = `${STRONG_BUNNY_ROOT}/stages/${base.key}.webp`;
  return {
    ...base,
    description,
    previewAsset: stageRoot,
    idleAsset: `${STRONG_BUNNY_ROOT}/motions/${base.key}/idle.webp`,
    lockedPreviewAsset: base.key === "final" ? stageRoot : null,
    motionAssets: strongBunnyMotionAssets(base.key),
  };
}

export const DEFAULT_COMPANION_STAGES: CompanionStageDefinition[] = [
  { key: "initial", name: "初始期", description: "刚刚成为训练搭档，正在熟悉共同训练的节奏。", minimumDays: 0, minimumGrowth: 0, minimumWorkouts: 0, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
  { key: "adaptation", name: "适应期", description: "姿态更加稳定，开始形成规律训练的习惯。", minimumDays: 7, minimumGrowth: 200, minimumWorkouts: 2, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
  { key: "growth", name: "成长期", description: "动作逐渐熟练，身体与精神状态都更有活力。", minimumDays: 21, minimumGrowth: 650, minimumWorkouts: 6, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
  { key: "strength", name: "强化期", description: "训练表现更加稳定，力量感与自信逐渐增强。", minimumDays: 42, minimumGrowth: 1350, minimumWorkouts: 12, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
  { key: "mature", name: "成熟期", description: "动作流畅、状态均衡，形成属于自己的训练风格。", minimumDays: 63, minimumGrowth: 2200, minimumWorkouts: 20, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
  { key: "final", name: "最终形态", description: "成为健康、自信、充满活力的长期训练搭档。", minimumDays: 84, minimumGrowth: 3300, minimumWorkouts: 30, previewAsset: null, idleAsset: null, lockedPreviewAsset: null },
];

const STRONG_BUNNY_STAGE_DESCRIPTIONS = [
  "刚刚拿起哑铃，动作还有些生疏，但已经准备和你一起开始。",
  "戴上训练头带，姿态更稳定，也逐渐适应规律训练。",
  "力量和动作熟练度开始增长，举起哑铃时更有自信。",
  "四肢更强壮，穿上训练鞋，并学会在训练间隙主动恢复。",
  "身材结实均衡，训练节奏成熟，也更懂得观察恢复状态。",
  "成为健康、自信又充满活力的力量兔，解锁金色训练装备。",
];

const STRONG_BUNNY_STAGES: CompanionStageDefinition[] = DEFAULT_COMPANION_STAGES.map((stage, index) =>
  strongBunnyStage(stage, STRONG_BUNNY_STAGE_DESCRIPTIONS[index] || stage.description));

export const COMPANION_CATALOG: CompanionDefinition[] = [{
  id: "strong-bunny",
  version: 1,
  name: "力力兔",
  introduction: "一只乐观、认真又懂得休息的健身兔。它会从训练新手开始，用你的真实训练记录逐步成长为健康有力的长期搭档。",
  growthDirection: "从训练新手成长为健康、自信的力量兔",
  growthCycleDays: 84,
  specialties: ["力量训练", "综合训练", "规律坚持"],
  personality: ["乐观", "认真", "重视恢复"],
  stages: STRONG_BUNNY_STAGES,
  motionAssets: strongBunnyMotionAssets("initial"),
  interactionAssets: {
    greeting: `${STRONG_BUNNY_ROOT}/motions/initial/idle.webp`,
    cheer: `${STRONG_BUNNY_ROOT}/motions/initial/celebrate.webp`,
  },
  voiceAvailable: false,
}];

export function findCompanionDefinition(id: string) {
  return COMPANION_CATALOG.find((definition) => definition.id === id) || null;
}
