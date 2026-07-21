const DATA_URL = "/vendor/exercises-dataset/data/exercises.json";
const SOURCE_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const MEDIA_BASE = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${SOURCE_COMMIT}/`;
const SOURCE_BASE = `https://github.com/hasaneyldrm/exercises-dataset/tree/${SOURCE_COMMIT}`;
const PAGE_SIZE = 24;

const BODY_PART_LABELS = {
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

const EQUIPMENT_LABELS = {
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

const MUSCLE_LABELS = {
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

const EXERCISE_NAMES = {
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

const CATEGORY_ORDER = [
  "chest", "back", "shoulders", "upper arms", "upper legs", "waist",
  "lower legs", "lower arms", "cardio", "neck",
];

const state = {
  exercises: [],
  filtered: [],
  visibleCount: PAGE_SIZE,
  category: "",
  equipment: "",
  query: "",
  selected: null,
  mediaPaused: false,
};

const dom = {
  categoryFilters: document.querySelector("#categoryFilters"),
  clearFilters: document.querySelector("#clearFilters"),
  dataStatus: document.querySelector("#dataStatus"),
  detailEnglishName: document.querySelector("#detailEnglishName"),
  detailImage: document.querySelector("#detailImage"),
  detailMedia: document.querySelector("#detailMedia"),
  detailSecondary: document.querySelector("#detailSecondary"),
  detailTags: document.querySelector("#detailTags"),
  detailTarget: document.querySelector("#detailTarget"),
  detailTitle: document.querySelector("#detailTitle"),
  dialog: document.querySelector("#exerciseDialog"),
  dialogClose: document.querySelector("#dialogClose"),
  emptyClearButton: document.querySelector("#emptyClearButton"),
  emptyState: document.querySelector("#emptyState"),
  equipmentFilter: document.querySelector("#equipmentFilter"),
  errorMessage: document.querySelector("#errorMessage"),
  errorState: document.querySelector("#errorState"),
  exerciseGrid: document.querySelector("#exerciseGrid"),
  heroCount: document.querySelector("#heroCount"),
  instructionList: document.querySelector("#instructionList"),
  languageState: document.querySelector("#languageState"),
  loadingState: document.querySelector("#loadingState"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  loadMoreWrap: document.querySelector("#loadMoreWrap"),
  mediaError: document.querySelector("#mediaError"),
  mediaToggle: document.querySelector("#mediaToggle"),
  resultsSection: document.querySelector("#resultsSection"),
  resultsSummary: document.querySelector("#resultsSummary"),
  retryButton: document.querySelector("#retryButton"),
  searchInput: document.querySelector("#searchInput"),
  sourceLink: document.querySelector("#sourceLink"),
  visibleSummary: document.querySelector("#visibleSummary"),
};

function titleCase(value = "") {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function bodyPartLabel(value) {
  return BODY_PART_LABELS[value] || titleCase(value) || "未分类";
}

function equipmentLabel(value) {
  return EQUIPMENT_LABELS[value] || titleCase(value) || "未注明";
}

function muscleLabel(value) {
  return MUSCLE_LABELS[value] || titleCase(value) || "未注明";
}

function exerciseName(exercise) {
  return EXERCISE_NAMES[exercise.id]?.[0] || titleCase(exercise.name);
}

function normalize(value = "") {
  return value.toLocaleLowerCase("zh-CN").replace(/[()\-_/]/g, " ").replace(/\s+/g, " ").trim();
}

function mediaUrl(path) {
  if (!/^(images|videos)\/[a-zA-Z0-9._()°в-]+$/.test(path || "")) return "";
  return `${MEDIA_BASE}${encodeURI(path)}`;
}

function createSearchIndex(exercise) {
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

function sortExercises(exercises) {
  const featuredRank = new Map(FEATURED_IDS.map((id, index) => [id, index]));
  return [...exercises].sort((a, b) => {
    const aRank = featuredRank.has(a.id) ? featuredRank.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bRank = featuredRank.has(b.id) ? featuredRank.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "en");
  });
}

function renderCategoryFilters() {
  const fragment = document.createDocumentFragment();
  const values = ["", ...CATEGORY_ORDER.filter((category) => state.exercises.some((exercise) => exercise.body_part === category))];

  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.category === value ? " active" : ""}`;
    button.dataset.category = value;
    button.textContent = value ? bodyPartLabel(value) : "全部";
    button.setAttribute("aria-pressed", String(state.category === value));
    fragment.append(button);
  }

  dom.categoryFilters.replaceChildren(fragment);
}

function renderEquipmentOptions() {
  const counts = new Map();
  for (const exercise of state.exercises) {
    counts.set(exercise.equipment, (counts.get(exercise.equipment) || 0) + 1);
  }

  const options = [...counts.keys()].sort((a, b) => {
    const difference = counts.get(b) - counts.get(a);
    return difference || equipmentLabel(a).localeCompare(equipmentLabel(b), "zh-CN");
  });

  const fragment = document.createDocumentFragment();
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "全部器械";
  fragment.append(allOption);

  for (const value of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${equipmentLabel(value)} · ${counts.get(value)}`;
    fragment.append(option);
  }

  dom.equipmentFilter.replaceChildren(fragment);
}

function cardTemplate(exercise) {
  const translatedName = EXERCISE_NAMES[exercise.id]?.[0];
  const secondaryName = translatedName ? exercise.name : "中文常用名待整理";
  const thumbnail = mediaUrl(exercise.image);
  const target = muscleLabel(exercise.target);
  const equipment = equipmentLabel(exercise.equipment);

  return `
    <span class="card-part">${escapeHtml(bodyPartLabel(exercise.body_part))}</span>
    <span class="card-media">
      <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(exerciseName(exercise))}动作缩略图" loading="lazy" decoding="async" />
    </span>
    <span class="card-body">
      <span class="card-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </span>
      <h3>${escapeHtml(exerciseName(exercise))}</h3>
      <p class="card-english">${escapeHtml(secondaryName)}</p>
      <span class="card-meta">
        <span title="目标肌群">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
          ${escapeHtml(target)}
        </span>
        <span title="所需器械">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>
          ${escapeHtml(equipment)}
        </span>
      </span>
    </span>
  `;
}

function renderCards() {
  const visible = state.filtered.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();

  for (const exercise of visible) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "exercise-card";
    card.dataset.exerciseId = exercise.id;
    card.setAttribute("aria-label", `查看${exerciseName(exercise)}动作指导`);
    card.innerHTML = cardTemplate(exercise);
    const image = card.querySelector("img");
    image.addEventListener("error", () => image.closest(".card-media").classList.add("media-failed"), { once: true });
    fragment.append(card);
  }

  dom.exerciseGrid.replaceChildren(fragment);
  const hasMore = state.visibleCount < state.filtered.length;
  dom.loadMoreWrap.hidden = state.filtered.length === 0;
  dom.loadMoreButton.hidden = !hasMore;
  dom.visibleSummary.textContent = `已显示 ${Math.min(state.visibleCount, state.filtered.length).toLocaleString("zh-CN")} / ${state.filtered.length.toLocaleString("zh-CN")} 个动作`;
}

function updateResults() {
  const normalizedQuery = normalize(state.query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  state.filtered = state.exercises.filter((exercise) => {
    const matchesQuery = queryTokens.length === 0 || queryTokens.every((token) => exercise._searchIndex.includes(token));
    const matchesCategory = !state.category || exercise.body_part === state.category;
    const matchesEquipment = !state.equipment || exercise.equipment === state.equipment;
    return matchesQuery && matchesCategory && matchesEquipment;
  });

  const isFiltered = Boolean(normalizedQuery || state.category || state.equipment);
  dom.clearFilters.hidden = !isFiltered;
  dom.resultsSummary.textContent = isFiltered
    ? `找到 ${state.filtered.length.toLocaleString("zh-CN")} 个匹配动作`
    : `精选常用动作优先展示，共 ${state.filtered.length.toLocaleString("zh-CN")} 个`;
  dom.emptyState.hidden = state.filtered.length !== 0;
  dom.exerciseGrid.hidden = state.filtered.length === 0;
  renderCards();
}

function clearFilters() {
  state.query = "";
  state.category = "";
  state.equipment = "";
  state.visibleCount = PAGE_SIZE;
  dom.searchInput.value = "";
  dom.equipmentFilter.value = "";
  renderCategoryFilters();
  updateResults();
}

function getInstructionSteps(exercise) {
  const chinese = exercise.instruction_steps?.zh?.filter(Boolean) || [];
  if (chinese.length) return { steps: chinese, language: "中文指导" };

  if (exercise.instructions?.zh) {
    return { steps: [exercise.instructions.zh], language: "中文指导" };
  }

  const english = exercise.instruction_steps?.en?.filter(Boolean) || [];
  if (english.length) return { steps: english, language: "中文缺失 · 已回退英文" };
  return { steps: [exercise.instructions?.en || "该动作暂时没有可用步骤。"], language: "英文指导" };
}

function renderDetail(exercise) {
  state.selected = exercise;
  state.mediaPaused = false;
  dom.detailTitle.textContent = exerciseName(exercise);
  dom.detailEnglishName.textContent = EXERCISE_NAMES[exercise.id] ? titleCase(exercise.name) : "上游暂未提供中文动作名";
  dom.detailTarget.textContent = muscleLabel(exercise.target);
  dom.detailSecondary.textContent = (exercise.secondary_muscles || []).map(muscleLabel).join("、") || muscleLabel(exercise.muscle_group);
  dom.detailTags.replaceChildren();

  for (const label of [bodyPartLabel(exercise.body_part), equipmentLabel(exercise.equipment), `动作 ID · ${exercise.id}`]) {
    const tag = document.createElement("span");
    tag.className = "detail-tag";
    tag.textContent = label;
    dom.detailTags.append(tag);
  }

  const { steps, language } = getInstructionSteps(exercise);
  dom.languageState.textContent = language;
  dom.instructionList.replaceChildren();
  for (const step of steps) {
    const item = document.createElement("li");
    item.textContent = step;
    dom.instructionList.append(item);
  }

  dom.detailImage.hidden = false;
  dom.mediaError.hidden = true;
  dom.mediaToggle.hidden = false;
  dom.detailImage.alt = `${exerciseName(exercise)}动作动态示范`;
  dom.detailImage.src = mediaUrl(exercise.gif_url);
  setMediaToggleLabel(false);
  dom.sourceLink.href = `${SOURCE_BASE}/videos`;
}

function setMediaToggleLabel(paused) {
  dom.mediaToggle.innerHTML = paused
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z" /></svg><span>继续播放</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg><span>暂停动图</span>';
}

function openExercise(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  renderDetail(exercise);
  if (!dom.dialog.open) dom.dialog.showModal();
}

function toggleMedia() {
  if (!state.selected) return;
  state.mediaPaused = !state.mediaPaused;
  dom.detailImage.src = state.mediaPaused
    ? mediaUrl(state.selected.image)
    : mediaUrl(state.selected.gif_url);
  dom.detailImage.alt = `${exerciseName(state.selected)}动作${state.mediaPaused ? "静态" : "动态"}示范`;
  setMediaToggleLabel(state.mediaPaused);
}

function handleDataError(error) {
  console.error(error);
  dom.loadingState.hidden = true;
  dom.errorState.hidden = false;
  dom.resultsSection.setAttribute("aria-busy", "false");
  dom.dataStatus.textContent = "动作数据加载失败";
  document.querySelector(".topbar-state .status-dot")?.classList.add("error");
  dom.errorMessage.textContent = error instanceof Error ? error.message : "未知错误，请重试。";
}

async function loadData() {
  dom.loadingState.hidden = false;
  dom.errorState.hidden = true;
  dom.emptyState.hidden = true;
  dom.exerciseGrid.hidden = true;
  dom.loadMoreWrap.hidden = true;
  dom.resultsSection.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`读取动作数据失败（HTTP ${response.status}）`);
    const records = await response.json();
    if (!Array.isArray(records) || records.length === 0) throw new Error("动作数据格式不正确。");

    state.exercises = sortExercises(records.map((exercise) => ({
      ...exercise,
      _searchIndex: createSearchIndex(exercise),
    })));
    state.visibleCount = PAGE_SIZE;
    renderCategoryFilters();
    renderEquipmentOptions();
    updateResults();

    dom.heroCount.textContent = state.exercises.length.toLocaleString("zh-CN");
    dom.dataStatus.textContent = `${state.exercises.length.toLocaleString("zh-CN")} 个动作已就绪`;
    document.querySelector(".topbar-state .status-dot")?.classList.remove("error");
    dom.loadingState.hidden = true;
    dom.exerciseGrid.hidden = false;
    dom.resultsSection.setAttribute("aria-busy", "false");
  } catch (error) {
    handleDataError(error);
  }
}

dom.categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.visibleCount = PAGE_SIZE;
  renderCategoryFilters();
  updateResults();
});

dom.equipmentFilter.addEventListener("change", () => {
  state.equipment = dom.equipmentFilter.value;
  state.visibleCount = PAGE_SIZE;
  updateResults();
});

dom.searchInput.addEventListener("input", () => {
  state.query = dom.searchInput.value;
  state.visibleCount = PAGE_SIZE;
  updateResults();
});

dom.exerciseGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-exercise-id]");
  if (card) openExercise(card.dataset.exerciseId);
});

dom.loadMoreButton.addEventListener("click", () => {
  state.visibleCount += PAGE_SIZE;
  renderCards();
});

dom.clearFilters.addEventListener("click", clearFilters);
dom.emptyClearButton.addEventListener("click", clearFilters);
dom.retryButton.addEventListener("click", loadData);
dom.dialogClose.addEventListener("click", () => dom.dialog.close());
dom.mediaToggle.addEventListener("click", toggleMedia);

dom.detailImage.addEventListener("error", () => {
  dom.detailImage.hidden = true;
  dom.mediaError.hidden = false;
  dom.mediaToggle.hidden = true;
});

dom.dialog.addEventListener("click", (event) => {
  if (event.target === dom.dialog) dom.dialog.close();
});

dom.dialog.addEventListener("close", () => {
  dom.detailImage.removeAttribute("src");
  state.selected = null;
});

document.addEventListener("keydown", (event) => {
  const tagName = document.activeElement?.tagName;
  const isTyping = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  if (event.key === "/" && !isTyping && !dom.dialog.open) {
    event.preventDefault();
    dom.searchInput.focus();
  }
});

loadData();
