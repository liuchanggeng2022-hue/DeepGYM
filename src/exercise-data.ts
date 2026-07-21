import type { Exercise, IndexedExercise } from "./types";

export const SOURCE_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
export const MEDIA_BASE = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${SOURCE_COMMIT}/`;
export const SOURCE_BASE = `https://github.com/hasaneyldrm/exercises-dataset/tree/${SOURCE_COMMIT}`;
export const PAGE_SIZE = 24;

const BODY_PART_LABELS: Record<string, string> = {
  "upper arms": "上臂",
  "lower arms": "前臂",
  shoulders: "肩部",
  chest: "胸部",
  back: "背部",
  waist: "核心",
  "upper legs": "大腿",
  "lower legs": "小腿",
  cardio: "心肺",
  neck: "颈部",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  "body weight": "自重",
  dumbbell: "哑铃",
  barbell: "杠铃",
  cable: "绳索",
  "leverage machine": "固定器械",
  band: "弹力带",
  "resistance band": "阻力带",
  "smith machine": "史密斯机",
  kettlebell: "壶铃",
  weighted: "负重",
  "stability ball": "健身球",
  "ez barbell": "曲杆杠铃",
  "medicine ball": "药球",
  "sled machine": "腿举机",
  "assisted machine": "助力器械",
  assisted: "助力器械",
  "bosu ball": "波速球",
  rope: "训练绳",
  roller: "泡沫轴",
  "wheel roller": "健腹轮",
  tire: "轮胎",
};

const MUSCLE_LABELS: Record<string, string> = {
  abs: "腹肌",
  abductors: "髋外展肌",
  adductors: "髋内收肌",
  biceps: "肱二头肌",
  calves: "小腿肌群",
  cardiovascular: "心肺系统",
  "cardiovascular system": "心肺系统",
  delts: "三角肌",
  forearms: "前臂肌群",
  glutes: "臀肌",
  hamstrings: "腘绳肌",
  lats: "背阔肌",
  pectorals: "胸肌",
  quads: "股四头肌",
  traps: "斜方肌",
  triceps: "肱三头肌",
  spine: "竖脊肌",
  "upper back": "上背部",
  "lower back": "下背部",
  "hip flexors": "髋屈肌",
  "serratus anterior": "前锯肌",
  shoulders: "肩部",
};

const EXERCISE_NAMES: Record<string, [string, string]> = {
  "0025": ["杠铃卧推", "卧推 胸推 bench press"],
  "0043": ["杠铃深蹲", "深蹲 squat"],
  "0032": ["杠铃硬拉", "硬拉 deadlift"],
  "0652": ["引体向上", "引体 pull up pull-up"],
  "0294": ["哑铃弯举", "二头弯举 biceps curl"],
  "0334": ["哑铃侧平举", "侧平举 lateral raise"],
  "0662": ["俯卧撑", "伏地挺身 push up push-up"],
  "1160": ["波比跳", "burpee"],
  "0630": ["登山跑", "登山者 mountain climber"],
  "0687": ["俄罗斯转体", "转体 russian twist"],
  "0027": ["杠铃俯身划船", "划船 bent over row"],
  "0405": ["坐姿哑铃推举", "肩推 shoulder press"],
  "0426": ["站姿哑铃推举", "肩推 overhead press"],
  "1760": ["哑铃高脚杯深蹲", "高脚杯深蹲 goblet squat"],
  "0336": ["哑铃弓步", "弓箭步 lunge"],
  "0085": ["杠铃罗马尼亚硬拉", "罗马尼亚硬拉 romanian deadlift"],
  "1459": ["哑铃罗马尼亚硬拉", "罗马尼亚硬拉 romanian deadlift"],
  "0861": ["坐姿绳索划船", "坐姿划船 seated cable row"],
  "0308": ["哑铃飞鸟", "飞鸟 dumbbell fly"],
  "0241": ["V 把绳索下压", "三头下压 triceps pushdown"],
  "0313": ["哑铃锤式弯举", "锤式弯举 hammer curl"],
  "0585": ["器械腿屈伸", "腿屈伸 leg extension"],
  "0586": ["器械俯卧腿弯举", "腿弯举 lying leg curl"],
  "0739": ["45 度腿举", "腿举 leg press"],
};

const FEATURED_IDS = [
  "0025", "0043", "0032", "0652", "0662", "0405", "0027", "1760",
  "0336", "0085", "0308", "0861", "0334", "0294", "0313", "0241",
  "0585", "0586", "0630", "1160", "0687", "0739", "0426", "1459",
];

export const CATEGORY_ORDER = [
  "chest", "back", "shoulders", "upper arms", "upper legs", "waist",
  "lower legs", "lower arms", "cardio", "neck",
];

function titleCase(value = "") {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function bodyPartLabel(value: string) {
  return BODY_PART_LABELS[value] || titleCase(value) || "未分类";
}

export function equipmentLabel(value: string) {
  return EQUIPMENT_LABELS[value] || titleCase(value) || "未注明";
}

export function muscleLabel(value: string) {
  return MUSCLE_LABELS[value] || titleCase(value) || "未注明";
}

export function exerciseName(exercise: Exercise) {
  return EXERCISE_NAMES[exercise.id]?.[0] || titleCase(exercise.name);
}

export function hasChineseExerciseName(exercise: Exercise) {
  return Boolean(EXERCISE_NAMES[exercise.id]);
}

export function normalize(value = "") {
  return value.toLocaleLowerCase("zh-CN").replace(/[()\-_/]/g, " ").replace(/\s+/g, " ").trim();
}

export function mediaUrl(path: string) {
  if (!/^(images|videos)\/[a-zA-Z0-9._()°в-]+$/.test(path || "")) return "";
  return `${MEDIA_BASE}${encodeURI(path)}`;
}

function createSearchIndex(exercise: Exercise) {
  const translated = EXERCISE_NAMES[exercise.id] || [];
  const values = [
    exercise.name,
    ...translated,
    exercise.body_part,
    bodyPartLabel(exercise.body_part),
    exercise.equipment,
    equipmentLabel(exercise.equipment),
    exercise.target,
    muscleLabel(exercise.target),
    exercise.muscle_group,
    ...(exercise.secondary_muscles || []),
  ];
  return normalize(values.filter(Boolean).join(" "));
}

export function indexAndSortExercises(exercises: Exercise[]): IndexedExercise[] {
  const featuredRank = new Map(FEATURED_IDS.map((id, index) => [id, index]));
  return exercises
    .map((exercise) => ({ ...exercise, searchIndex: createSearchIndex(exercise) }))
    .sort((a, b) => {
      const aRank = featuredRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = featuredRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name, "en");
    });
}

export function instructionSteps(exercise: Exercise) {
  const chinese = exercise.instruction_steps?.zh?.filter(Boolean) || [];
  if (chinese.length) return { steps: chinese, language: "中文指导" };

  if (exercise.instructions?.zh) {
    return { steps: [exercise.instructions.zh], language: "中文指导" };
  }

  const english = exercise.instruction_steps?.en?.filter(Boolean) || [];
  if (english.length) return { steps: english, language: "中文缺失 · 已回退英文" };
  return { steps: [exercise.instructions?.en || "该动作暂时没有可用步骤。"], language: "英文指导" };
}
