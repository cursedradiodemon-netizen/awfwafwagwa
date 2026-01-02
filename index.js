require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const fetchFn =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
} = require("discord.js");

// ===== Crash logs =====
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CASEFILE_CHANNEL_ID = process.env.CASEFILE_CHANNEL_ID;
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;
const CASES_CHANNEL_ID = process.env.CASES_CHANNEL_ID;
const APPLICATIONS_CHANNEL_ID = process.env.APPLICATIONS_CHANNEL_ID;

const EVENTLOG_CHANNEL_ID = process.env.EVENTLOG_CHANNEL_ID; // (legacy if you still use it)
const RANKLOG_CHANNEL_ID = process.env.RANKLOG_CHANNEL_ID;
const BLACKLIST_LOG_CHANNEL_ID = process.env.BLACKLIST_LOG_CHANNEL_ID;
const ACADEMY_LOG_CHANNEL_ID = process.env.ACADEMY_LOG_CHANNEL_ID;
const APPEALS_CHANNEL_ID = process.env.APPEALS_CHANNEL_ID;

const ROWIFI_TOKEN = process.env.ROWIFI_TOKEN;
const BLACKLIST_SHEET_ID = process.env.BLACKLIST_SHEET_ID;
const BLACKLIST_SHEET_GID = process.env.BLACKLIST_SHEET_GID;


const DISCORD_RANK_ROLE_MAP = (() => {
  try {
    return JSON.parse(process.env.DISCORD_RANK_ROLE_MAP || "{}");
  } catch {
    console.error("❌ Invalid DISCORD_RANK_ROLE_MAP JSON in .env");
    return {};
  }
})();



// Roblox Open Cloud
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_OPEN_CLOUD_KEY = process.env.ROBLOX_OPEN_CLOUD_KEY;

// Optional: map STAFF rank (1-27) -> Roblox group roleId
let RANK_TO_ROBLOX_ROLE_MAP = {};
try {
  if (process.env.RANK_TO_ROBLOX_ROLE_MAP) {
    RANK_TO_ROBLOX_ROLE_MAP = JSON.parse(process.env.RANK_TO_ROBLOX_ROLE_MAP);
  }
} catch (e) {
  console.error("Invalid RANK_TO_ROBLOX_ROLE_MAP JSON in .env:", e);
  RANK_TO_ROBLOX_ROLE_MAP = {};
}

// Weekly report destination (your fixed channel)
const WEEKLY_REPORT_CHANNEL_ID = "1453942280745648188";

// /logevent destinations (from your links)
const LOGEVENT_ACADEMY_CHANNEL_ID = "1454298894463668245";
const LOGEVENT_OTHER_CHANNEL_ID = "1453981857099284521";

// ===============================
// NOTICE (Leave / Inactivity)
// ===============================
const NOTICE_CHANNEL_ID = process.env.NOTICE_CHANNEL_ID;
const NOTICE_PING_ROLE_ID = process.env.NOTICE_PING_ROLE_ID;

// ===== Role Rules =====
// Case permissions (ONLY these 3)
const CASE_ROLE_IDS = new Set([
  "1453937133701173422",
  "1453929754674597971",
  "1453929411081404416",
]);

// XP + Weekly Report restricted to this role
const XP_MANAGER_ROLE_ID = "1453929411081404416";

// redact/ranklock/revokepunishment restricted to these 2 roles
const HIGH_COMMAND_ROLE_IDS = new Set([
  "1453929754674597971",
  "1453929411081404416",
]);

// Blacklist add/revoke ONLY this one
const BLACKLIST_MANAGER_ROLE_ID = "1453929411081404416";

// Applications reviewers
const APPLICATION_REVIEW_ROLE_IDS = new Set([
  "1453929803273994291",
  "1453929455398682645",
]);

// Rank manager ONLY this one
const RANK_MANAGER_ROLE_ID = "1453929411081404416";

// Eventlog blocked role
const EVENTLOG_BLOCKED_ROLE_ID = "1453931984463073341";

// Academy eventlog restricted role
const ACADEMY_EVENTLOG_ROLE_ID = "1454291032119181324";

// Assign dept restricted role
const ASSIGNDEPT_ROLE_ID = "1453929455398682645";

// NEW REQUIRED ROLE CONSTANTS
const OWNER_ROLE_ID = "1453929140158861392";
const FULL_ACCESS_ROLES = ["1453938316490702890", "1453929246991847514", "1456185467388039198"];
const DISCIPLINE_ROLE_ID = "1453929754674597971";

// ===== Helpers =====
function hasRole(member, roleId) {
  return !!member?.roles?.cache?.has(roleId);
}
function hasAnyRole(member, roleSetOrArray) {
  if (!member?.roles?.cache) return false;
  if (Array.isArray(roleSetOrArray)) return roleSetOrArray.some((id) => member.roles.cache.has(id));
  return member.roles.cache.some((r) => roleSetOrArray.has(r.id));
}
function isCaseStaff(member) {
  return hasAnyRole(member, CASE_ROLE_IDS);
}
function isBlacklistManager(member) {
  return hasRole(member, BLACKLIST_MANAGER_ROLE_ID);
}
function isApplicationReviewer(member) {
  return hasAnyRole(member, APPLICATION_REVIEW_ROLE_IDS);
}
function isRankManager(member) {
  return hasRole(member, RANK_MANAGER_ROLE_ID);
}
function isEventlogBlocked(member) {
  return hasRole(member, EVENTLOG_BLOCKED_ROLE_ID);
}
function isAcademyLogger(member) {
  return hasRole(member, ACADEMY_EVENTLOG_ROLE_ID);
}
function isAssignDept(member) {
  return hasRole(member, ASSIGNDEPT_ROLE_ID);
}
function isXpManager(member) {
  return hasRole(member, XP_MANAGER_ROLE_ID);
}
function isHighCommand(member) {
  return hasAnyRole(member, HIGH_COMMAND_ROLE_IDS);
}
function canViewUnredacted(member) {
  return hasRole(member, OWNER_ROLE_ID) || hasAnyRole(member, FULL_ACCESS_ROLES);
}

function norm(str) {
  return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function normKey(str) {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getTextChannel(guild, id) {
  if (!id) return null;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || !ch.isTextBased()) return null;
  return ch;
}

// ===== Safe interaction helpers =====
async function safeAck(interaction, ephemeral = true) {
  if (!interaction.isRepliable()) return;
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ ephemeral });
}
async function safeReply(interaction, content, ephemeral = true) {
  if (!interaction.isRepliable()) return;
  if (interaction.deferred) return interaction.editReply({ content });
  if (interaction.replied) return interaction.followUp({ content, ephemeral });
  return interaction.reply({ content, ephemeral });
}

// ===== JSON storage helpers =====
function loadJsonMap(filePath) {
  const map = new Map();
  try {
    if (!fs.existsSync(filePath)) return map;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return map;
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  } catch (e) {
    console.error("Failed load:", filePath, e);
  }
  return map;
}
function saveJsonMap(filePath, map) {
  try {
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("Failed save:", filePath, e);
  }
}

// ===== Stores =====
const CASES_FILE = path.join(__dirname, "cases.json");
const cases = loadJsonMap(CASES_FILE);
const saveCases = () => saveJsonMap(CASES_FILE, cases);

const CASEFILES_FILE = path.join(__dirname, "casefiles.json");
const casefiles = loadJsonMap(CASEFILES_FILE);
const saveCasefiles = () => saveJsonMap(CASEFILES_FILE, casefiles);

const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const blacklist = loadJsonMap(BLACKLIST_FILE);
const saveBlacklist = () => saveJsonMap(BLACKLIST_FILE, blacklist);

const APPLICATIONS_FILE = path.join(__dirname, "applications.json");
const applications = loadJsonMap(APPLICATIONS_FILE);
const saveApplications = () => saveJsonMap(APPLICATIONS_FILE, applications);

const EVENTLOG_FILE = path.join(__dirname, "eventlogs.json");
const eventLogs = loadJsonMap(EVENTLOG_FILE);
const saveEventLogs = () => saveJsonMap(EVENTLOG_FILE, eventLogs);

const XP_FILE = path.join(__dirname, "xp.json");
const xpStore = loadJsonMap(XP_FILE);
const saveXP = () => saveJsonMap(XP_FILE, xpStore);

const ACADEMY_FILE = path.join(__dirname, "academy.json");
const academy = loadJsonMap(ACADEMY_FILE);
const saveAcademy = () => saveJsonMap(ACADEMY_FILE, academy);

const APPEALS_FILE = path.join(__dirname, "appeals.json");
const appeals = loadJsonMap(APPEALS_FILE);
const saveAppeals = () => saveJsonMap(APPEALS_FILE, appeals);

const ACTIVITY_FILE = path.join(__dirname, "activity.json");
const activityStore = loadJsonMap(ACTIVITY_FILE);
const saveActivity = () => saveJsonMap(ACTIVITY_FILE, activityStore);

// ===== STAFF RANK SYSTEM STORES =====
const STAFF_RANKS_FILE = path.join(__dirname, "staff_ranks.json"); // userId -> {rankId, setById, setAt}
const staffRanks = loadJsonMap(STAFF_RANKS_FILE);
const saveStaffRanks = () => saveJsonMap(STAFF_RANKS_FILE, staffRanks);

const STAFF_RANKLOCKS_FILE = path.join(__dirname, "staff_ranklocks.json"); // userId -> {maxRankId, lockedById, lockedAt}
const staffRankLocks = loadJsonMap(STAFF_RANKLOCKS_FILE);
const saveStaffRankLocks = () => saveJsonMap(STAFF_RANKLOCKS_FILE, staffRankLocks);

// ===== IDs =====
function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
function generateCaseId() {
  let id = genId("CASE");
  while (cases.has(id)) id = genId("CASE");
  return id;
}
function generateApplicationId() {
  let id = genId("APP");
  while (applications.has(id)) id = genId("APP");
  return id;
}
function generateAppealId() {
  let id = genId("APL");
  while (appeals.has(id)) id = genId("APL");
  return id;
}

// ===== XP =====
function getXP(userId) {
  return Number(xpStore.get(String(userId)) ?? 0) || 0;
}
function setXP(userId, value) {
  const id = String(userId);
  xpStore.set(id, Math.max(0, Math.floor(Number(value) || 0)));
  saveXP();
}
function addXP(userId, amount) {
  const id = String(userId);
  const cur = getXP(id);
  xpStore.set(id, Math.max(0, cur + (Number(amount) || 0)));
  saveXP();
}

// ===== XP Rank Ladder =====
const XP_RANKS = [
  "Starter",
  "Attendant",
  "Junior Member",
  "Member",
  "Assistant",
  "Senior Assistant",
  "Coordinator",
  "Senior Coordinator",
  "Manager",
  "Senior Manager",
  "Director",
  "Senior Director",
];

function computeXpRank(totalXp) {
  const perRank = 100;
  const idx = Math.floor(totalXp / perRank);
  const maxIdx = XP_RANKS.length - 1;
  const curIdx = Math.min(idx, maxIdx);
  const current = XP_RANKS[curIdx];
  const next = curIdx < maxIdx ? XP_RANKS[curIdx + 1] : null;
  const within = curIdx >= maxIdx ? perRank : totalXp % perRank;
  const pct = curIdx >= maxIdx ? 100 : (within / perRank) * 100;
  const needed = curIdx >= maxIdx ? 0 : perRank - within;
  return { perRank, curIdx, current, next, within, pct, needed, maxed: curIdx >= maxIdx };
}

function progressBar(pct, size = 22) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round((p / 100) * size);
  const empty = Math.max(0, size - filled);
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

// ===== Time parsing for /logevent =====
function parseTimeToMinutes(inputRaw) {
  const input = String(inputRaw).trim().toLowerCase();

  const m24 = input.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  const m12 = input.match(/^(\d{1,2})(?:\s*:\s*(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2] ? Number(m12[2]) : 0;
    const ap = m12[3];
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ap === "am") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return h * 60 + min;
  }

  const mShort = input.match(/^(\d{1,2})\s*(am|pm)$/);
  if (mShort) {
    let h = Number(mShort[1]);
    const ap = mShort[2];
    if (h < 1 || h > 12) return null;
    if (ap === "am") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return h * 60;
  }

  return null;
}

function formatDuration(totalMinutes) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ===== RoWifi =====
async function getRoWifiRobloxId(discordUserId) {
  if (!ROWIFI_TOKEN || !GUILD_ID) return null;
  const url = `https://api.rowifi.xyz/v3/guilds/${GUILD_ID}/members/${discordUserId}`;
  const res = await fetchFn(url, { headers: { Authorization: `Bot ${ROWIFI_TOKEN}` } }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.roblox_id ? String(data.roblox_id) : null;
}
async function getRobloxUsername(robloxId) {
  const res = await fetchFn(`https://users.roblox.com/v1/users/${robloxId}`).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.name ?? null;
}

// ===== CSV parsing for Google sheet blacklist =====
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function checkSheetBlacklist(discordUserId) {
  if (!BLACKLIST_SHEET_ID || !BLACKLIST_SHEET_GID) {
    return { isBlacklisted: false, robloxUsernameFromSheet: null };
  }
  const url = `https://docs.google.com/spreadsheets/d/${BLACKLIST_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${BLACKLIST_SHEET_GID}`;
  const res = await fetchFn(url).catch(() => null);
  if (!res || !res.ok) return { isBlacklisted: false, robloxUsernameFromSheet: null };
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { isBlacklisted: false, robloxUsernameFromSheet: null };

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 10) continue;

    const dDiscordId = row[3];
    const eRobloxUser = row[4] || null;
    const iStatus = (row[8] || "").trim();
    const jType = (row[9] || "").trim();

    if (String(dDiscordId).trim() !== String(discordUserId).trim()) continue;

    const typeMatch =
      jType.toLowerCase() === "prohibited from all" || jType.toLowerCase() === "business staff";
    const statusLower = iStatus.toLowerCase();
    const statusMatch = statusLower !== "appealed" && statusLower !== "expired";

    if (typeMatch && statusMatch) return { isBlacklisted: true, robloxUsernameFromSheet: eRobloxUser };
    return { isBlacklisted: false, robloxUsernameFromSheet: eRobloxUser };
  }

  return { isBlacklisted: false, robloxUsernameFromSheet: null };
}

function isBotBlacklisted(discordUserId) {
  const entry = blacklist.get(String(discordUserId));
  if (!entry) return false;
  return entry.revoked ? false : true;
}

// ===== Activity logging =====
function getActivityState(userId) {
  const id = String(userId);
  return activityStore.get(id) || { userId: id, events: [] };
}
function pushActivity(userId, type, desc, meta = {}) {
  const st = getActivityState(userId);
  st.events = Array.isArray(st.events) ? st.events : [];
  st.events.unshift({
    type: String(type),
    desc: String(desc || ""),
    at: new Date().toISOString(),
    meta,
  });
  if (st.events.length > 300) st.events = st.events.slice(0, 300);
  activityStore.set(String(userId), st);
  saveActivity();
}
function getAllActivityCountsInWindow(msWindow) {
  const cutoff = Date.now() - msWindow;
  const out = [];
  for (const [uid, st] of activityStore.entries()) {
    const count = (st?.events || []).filter((e) => new Date(e.at).getTime() >= cutoff).length;
    if (count > 0) out.push({ userId: uid, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ===== Appeal cooldown =====
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getUserAppealState(userId) {
  const id = String(userId);
  return (
    appeals.get(id) || {
      userId: id,
      pending: null,
      deniedUntil: 0,
      history: [],
    }
  );
}
function setUserAppealState(userId, state) {
  appeals.set(String(userId), state);
  saveAppeals();
}

// ===== Find helpers =====
function findLatestActiveCaseAgainst(discordUserId) {
  const id = String(discordUserId);
  const all = Array.from(cases.values())
    .filter((c) => String(c.caseAgainstId) === id)
    .filter((c) => (c.status || "ACTIVE") !== "APPEALED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] || null;
}
function findLatestCasefileFor(discordUserId) {
  const id = String(discordUserId);
  const all = Array.from(casefiles.values())
    .filter((c) => String(c.targetDiscordId) === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] || null;
}

// =======================================================
// ✅ STAFF RANK DEFINITIONS (1–27 EXACT)
// =======================================================
const RANKS = {
  1: "Director of Security & Medical",
  2: "Deputy Director of Security & Medical",
  3: "Chief of Operations",
  4: "Chief of Administration",
  5: "Chief of Training",
  6: "Chief of Medical Services",
  7: "Operations Commander",
  8: "Security Operations Manager",
  9: "Compliance & Records Officer",
  10: "JR. Compliance & Records Officer",
  11: "Training Officer",
  12: "Senior Security Officer",
  13: "Medical Operations Supervisor",
  14: "Security Officer",
  15: "Junior Security Officer",
  16: "Probationary Guard",
  17: "Medical Supervisor",
  18: "Lead Medic",
  19: "Paramedic",
  20: "Combat Medic",
  21: "Medical Technician",
  22: "Nurse",
  23: "Medical Trainee",
  24: "Training Staff",
  25: "VIP Contract Holder",
  26: "Contract Client",
  27: "Visitor",
};

function getStaffRank(userId) {
  const rec = staffRanks.get(String(userId));
  const rankId = rec?.rankId ? Number(rec.rankId) : 27;
  return Number.isFinite(rankId) && RANKS[rankId] ? rankId : 27;
}
function setStaffRank(userId, rankId, setById) {
  staffRanks.set(String(userId), {
    rankId: Number(rankId),
    setById: String(setById),
    setAt: new Date().toISOString(),
  });
  saveStaffRanks();
}
function getStaffRankLock(userId) {
  return staffRankLocks.get(String(userId)) || null;
}
function setStaffRankLock(userId, maxRankId, lockedById) {
  staffRankLocks.set(String(userId), {
    maxRankId: Number(maxRankId),
    lockedById: String(lockedById),
    lockedAt: new Date().toISOString(),
  });
  saveStaffRankLocks();
}

// ===== Roblox Open Cloud functions =====
async function rbxFetch(url, options = {}) {
  if (!ROBLOX_OPEN_CLOUD_KEY) throw new Error("Missing ROBLOX_OPEN_CLOUD_KEY");
  const headers = { ...(options.headers || {}), "x-api-key": ROBLOX_OPEN_CLOUD_KEY };
  const res = await fetchFn(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}

async function findMembershipIdByUserId(targetRobloxUserId) {
  if (!ROBLOX_GROUP_ID) throw new Error("Missing ROBLOX_GROUP_ID");
  let pageToken = null;
  for (let loops = 0; loops < 80; loops++) {
    const url =
      `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/memberships?maxPageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const { res, json } = await rbxFetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Memberships fetch failed: ${res.status} ${JSON.stringify(json)}`);
    const memberships = json?.groupMemberships || [];
    for (const m of memberships) {
      const parts = String(m.user || "").split("/");
      const userId = parts[parts.length - 1];
      if (String(userId) === String(targetRobloxUserId)) {
        const pathParts = String(m.path || "").split("/");
        const membershipId = pathParts[3];
        return membershipId || null;
      }
    }
    pageToken = json?.nextPageToken || null;
    if (!pageToken) break;
  }
  return null;
}


async function setMembershipRole(membershipId, roleId) {
  const url = `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GROUP_ID}/memberships/${membershipId}`;
  const { res, json } = await rbxFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: `groups/${ROBLOX_GROUP_ID}/roles/${roleId}` }),
  });
  if (!res.ok) throw new Error(`Role update failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// ===== Rank log embed (Roblox rank actions) =====
async function logRankAction(guild, payload) {
  const ch = await getTextChannel(guild, RANKLOG_CHANNEL_ID);
  if (!ch) return;
  const embed = {
    title: "🪪 Roblox Rank Action",
    color: payload.success ? 0x2ecc71 : 0xe74c3c,
    fields: [
      { name: "Action", value: payload.action, inline: true },
      { name: "Moderator", value: payload.moderator, inline: true },
      { name: "Target (Discord)", value: payload.targetDiscord, inline: false },
      { name: "Roblox", value: payload.robloxLine, inline: false },
      { name: "Result", value: payload.result, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
  await ch.send({ embeds: [embed] });
}

// ===== Blacklist log =====
async function logBlacklist(guild, title, fields, color = 0xff0000) {
  const ch = await getTextChannel(guild, BLACKLIST_LOG_CHANNEL_ID);
  if (!ch) return;
  await ch.send({ embeds: [{ title, color, fields, timestamp: new Date().toISOString() }] });
}

// ===== Cases channel logger =====
async function logToCasesChannel(guild, text) {
  const ch = await getTextChannel(guild, CASES_CHANNEL_ID);
  if (!ch) return;
  await ch.send({
    embeds: [
      {
        title: "📌 Discipline Log",
        color: 0x2f3136,
        description: String(text || "").slice(0, 4000),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ===== REDACTION HELPERS =====
const REDACT_TAG = "**REDACTED BY DISCIPLINE BRANCH**";
const PRIV_REDACT = "*REDACTED DUE TO PRIVACY REASONS*";

function ensureCaseShape(c) {
  if (!c) return c;
  if (!c.redactions) c.redactions = { all: false, fields: {} };
  if (typeof c.redactions.all !== "boolean") c.redactions.all = false;
  if (!c.redactions.fields || typeof c.redactions.fields !== "object") c.redactions.fields = {};
  return c;
}
function ensureCasefileShape(cf) {
  if (!cf) return cf;
  if (!cf.redactions) cf.redactions = { all: false, fields: {} };
  if (typeof cf.redactions.all !== "boolean") cf.redactions.all = false;
  if (!cf.redactions.fields || typeof cf.redactions.fields !== "object") cf.redactions.fields = {};
  if (!cf.status) cf.status = "ACTIVE";
  return cf;
}

// ===== Bot Control =====
async function refreshCommands() {
  return new Promise((resolve, reject) => {
    exec("node deploy-commands.js", (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout || "✅ Commands registered");
    });
  });
}

// =======================================================
// ✅ ACADEMY SYSTEM
// =======================================================

// Required events list (your existing list kept)
const REQUIRED_EVENTS = {
  security: ["Guarding Training", "Guarding Formation Training", "Final Evaluation"],
  medical: ["Medical Training", "Medical RP Training", "Final Evaluation"],
  both: ["Guarding Training", "Guarding Formation Training", "Medical Training", "Medical RP Training", "Final Evaluation"],
};

// Promotion targets
const ACADEMY_PROMO_SECURITY_RANK = 15; // Junior Security Officer
const ACADEMY_PROMO_MEDICAL_RANK = 22;  // Nurse

function canManageAcademy(member) {
  return isCaseStaff(member);
}

function getOrCreateAcademyRecord(discordUserId) {
  const id = String(discordUserId);
  const rec = academy.get(id) || {
    discordUserId: id,
    robloxUsername: "Unknown",
    dept: "Unassigned", // security / medical / both
    logs: [],
    graduated: false,
    graduatedAt: null,
    promotedToRankId: null,
  };
  if (!Array.isArray(rec.logs)) rec.logs = [];
  if (!rec.dept) rec.dept = "Unassigned";
  if (typeof rec.graduated !== "boolean") rec.graduated = false;
  academy.set(id, rec);
  saveAcademy();
  return rec;
}

function academyDeptKey(rec) {
  const k = normKey(rec?.dept);
  if (k === "security" || k === "secruity") return "security";
  if (k === "medical") return "medical";
  if (k === "both") return "both";
  return null;
}

function addAcademyLog(discordUserId, eventName, loggedById, proof = null) {
  const rec = getOrCreateAcademyRecord(discordUserId);
  rec.logs.unshift({
    event: String(eventName),
    proof: proof ? String(proof).slice(0, 900) : null,
    loggedById: String(loggedById || "0"),
    at: new Date().toISOString(),
  });
  academy.set(String(discordUserId), rec);
  saveAcademy();
  return rec;
}

function computeAcademyProgress(rec) {
  const deptKey = academyDeptKey(rec);
  const required = deptKey ? REQUIRED_EVENTS[deptKey] : [];
  const requiredNorm = required.map(normKey);

  const doneSet = new Set();
  for (const l of rec.logs || []) {
    const ev = normKey(l.event);
    for (let i = 0; i < requiredNorm.length; i++) {
      if (ev.includes(requiredNorm[i]) || requiredNorm[i].includes(ev)) doneSet.add(requiredNorm[i]);
    }
  }

  const done = doneSet.size;
  const total = required.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct, required };
}

async function tryGraduateAcademy(client, interaction, traineeId) {
  const rec = getOrCreateAcademyRecord(traineeId);
  const deptKey = academyDeptKey(rec);
  if (!deptKey) return { ok: false, msg: "Dept not set. Staff must run `/academyprogress setdept` first." };

  const prog = computeAcademyProgress(rec);
  if (prog.total <= 0) return { ok: false, msg: "No required events configured for that dept." };
  if (prog.done < prog.total) return { ok: false, msg: `Not complete yet: ${prog.done}/${prog.total}.` };
  if (rec.graduated) return { ok: true, msg: "Already graduated.", rec };

  let finalDept = deptKey;

  // If "both", ask trainee in DM (MessageContent is required)
  if (deptKey === "both") {
    const traineeUser = await client.users.fetch(String(traineeId)).catch(() => null);
    if (!traineeUser) return { ok: false, msg: "Could not DM trainee for dept choice." };

    try {
      await traineeUser.send(
        "✅ You completed **ALL** academy required events.\nReply with **Security** or **Medical** (10 minutes)."
      );
    } catch {
      return { ok: false, msg: "Could not DM trainee (DMs closed)." };
    }

    const dm = await traineeUser.createDM().catch(() => null);
    if (!dm) return { ok: false, msg: "Could not open DM channel." };

    const collected = await dm
      .awaitMessages({
        max: 1,
        time: 10 * 60 * 1000,
        filter: (m) => m.author.id === traineeUser.id,
      })
      .catch(() => null);

    const reply = collected?.first()?.content ? normKey(collected.first().content) : "";
    if (reply.includes("medical")) finalDept = "medical";
    else if (reply.includes("security") || reply.includes("secruity")) finalDept = "security";
    else {
      try {
        await traineeUser.send("⏱️ Time up / invalid reply. Run `/academyprogress view` in the server for more time.");
      } catch {}
      return { ok: false, msg: "Trainee did not choose a valid dept in time." };
    }
  }

  const promoteRankId = finalDept === "medical" ? ACADEMY_PROMO_MEDICAL_RANK : ACADEMY_PROMO_SECURITY_RANK;

  setStaffRank(String(traineeId), promoteRankId, interaction.user.id);

  rec.graduated = true;
  rec.graduatedAt = new Date().toISOString();
  rec.promotedToRankId = promoteRankId;
  academy.set(String(traineeId), rec);
  saveAcademy();

  const traineeUser = await client.users.fetch(String(traineeId)).catch(() => null);
  if (traineeUser) {
    try {
      await traineeUser.send(
        `🎓 You have **graduated** the academy!\nPrimary dept: **${finalDept}**\nPromoted to rank ID: **${promoteRankId}**`
      );
    } catch {}
  }

  return { ok: true, msg: `Graduated + promoted to rank **${promoteRankId}**.`, rec };
}

function academyProgressEmbed(user, rec) {
  const prog = computeAcademyProgress(rec);
  const deptKey = academyDeptKey(rec);
  const deptLabel = deptKey ? deptKey.toUpperCase() : "UNASSIGNED";

  const doneSet = new Set((rec.logs || []).map((l) => normKey(l.event)));
  const completedLines =
    (prog.required || [])
      .map((req) => {
        const hit = Array.from(doneSet).some((d) => d.includes(normKey(req)) || normKey(req).includes(d));
        return `${hit ? "✅" : "⬜"} ${req}`;
      })
      .join("\n") || "None";

  return {
    title: "🎓 Academy Progress",
    color: rec.graduated ? 0x2ecc71 : 0xffc107,
    fields: [
      { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
      { name: "Roblox Username", value: rec.robloxUsername || "Unknown", inline: true },
      { name: "Department", value: deptLabel, inline: true },
      { name: "Progress", value: `${prog.done}/${prog.total} (${prog.pct}%)`, inline: true },
      { name: "Checklist", value: completedLines.slice(0, 3500), inline: false },
      {
        name: "Status",
        value: rec.graduated
          ? `✅ Graduated\nPromoted rank ID: **${rec.promotedToRankId ?? "N/A"}**\nAt: ${rec.graduatedAt}`
          : "⏳ In progress (graduation locked until checklist complete)",
        inline: false,
      },
    ],
    footer: { text: "Use /academyprogress setdept + /academyprogress add to manage." },
    timestamp: new Date().toISOString(),
  };
}

// =======================================================
// ✅ NOTICE SYSTEM
// =======================================================
const NOTICES_FILE = path.join(__dirname, "notices.json");
const notices = loadJsonMap(NOTICES_FILE);
const saveNotices = () => saveJsonMap(NOTICES_FILE, notices);

function canReviewNotices(member) {
  return isCaseStaff(member);
}

function parseDMY(str) {
  const m = String(str || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
function utcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
}
function daysBetweenUTC(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
function buildNoticeEmbed(payload) {
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "America/Chicago" }); // DD/MM/YYYY
  return {
    title: "📌 Notice Submission (Pending Review)",
    color: 0xffc107,
    description:
      `**dc ping:** <@${payload.submitterId}>\n` +
      `**Roblox username:** ${payload.robloxUsername}\n` +
      `**Type of notice:** ${payload.noticeType}\n` +
      `**Reason:** ${payload.reason}\n` +
      `**Day Of Leave:** ${payload.leaveDate}\n` +
      `**Day Of Return:** ${payload.returnDate}\n\n` +
      `<@&${NOTICE_PING_ROLE_ID}>\n` +
      `-# Todays date: ${today}`,
    timestamp: new Date().toISOString(),
  };
}
function noticeButtons(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`notice_accept:${messageId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`notice_deny:${messageId}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
  );
}
function disabledNoticeButtons(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`notice_accept:${messageId}`).setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`notice_deny:${messageId}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(true)
  );
}

// =======================================================
// ✅ APPLY QUESTIONS (kept)
// =======================================================
const APPLY_QUESTIONS = {
  SECURITY: ["Why do you want to join Security?", "How would you handle a VIP being threatened?", "Any past experiences?"],
  MEDICAL: [
    "If you where shot at while healing a vip what would you do?",
    "If you where in an combat siution and your vip got low what do you priotize first VIP healing or Killing threat.",
  ],
  ACADEMY: ["Why do you wish to join the academy?", "If a candiate ask you a question on a eval or quiz what do you do?", "Any past expirences?"],
  ADMIN_DISC: [
    "If you got a report of someone Mass raiding on the team what would you do",
    "True or false you should deny a event if they dont have proof",
    "If you where to get a report on your self what would you do?",
    "Any past exprinces?",
  ],
  ALL: [
    "Why do you want to join?",
    "What departments interest you most?",
    "Any past experience?",
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =======================================================
// ✅ BOT CLIENT
// =======================================================
// IMPORTANT: You MUST enable Message Content Intent in the Developer Portal OR discord will throw:
// "Used disallowed intents"
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent, // ✅ added
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message], // ✅ include Message partial
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =======================================================
// ✅ BUTTONS / MODALS / COMMANDS
// =======================================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // =========================
    // Buttons
    // =========================
    if (interaction.isButton()) {
      // ---------- NOTICE BUTTONS ----------
      if (interaction.customId.startsWith("notice_accept:") || interaction.customId.startsWith("notice_deny:")) {
        if (!canReviewNotices(interaction.member)) return safeReply(interaction, "❌ Staff only.", true);

        const [action, msgId] = interaction.customId.split(":");
        const rec = notices.get(String(msgId));
        if (!rec) return safeReply(interaction, "❌ Notice not found in database.", true);
        if (rec.status && rec.status !== "PENDING") return safeReply(interaction, "❌ This notice is already finalized.", true);

        if (action === "notice_accept") {
          rec.status = "ACCEPTED";
          rec.reviewedById = interaction.user.id;
          rec.reviewedAt = new Date().toISOString();
          notices.set(String(msgId), rec);
          saveNotices();

          const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
          updated.color = 0x2ecc71;
          updated.footer = { text: `✅ Accepted by ${interaction.user.username}` };

          await interaction.message.edit({ embeds: [updated], components: [disabledNoticeButtons(msgId)] }).catch(() => {});

          const submitter = await client.users.fetch(rec.submitterId).catch(() => null);
          if (submitter) {
            const by = `${interaction.user}`;
            const msg =
              rec.noticeType === "INACTIVITY"
                ? `Your Inactivity notice was accepted by: ${by}\nwe hope you have fun on your off time.`
                : `Your leaving notice was accepted by: ${by}\nWe wish you safe travels in whatever you do in the future.`;
            try {
              await submitter.send(msg);
            } catch {}
          }
          return safeReply(interaction, "✅ Accepted.", true);
        }

        if (action === "notice_deny") {
          const modal = new ModalBuilder().setCustomId(`notice_deny_modal:${msgId}`).setTitle("Deny Notice");
          const reasonInput = new TextInputBuilder()
            .setCustomId("deny_reason")
            .setLabel("Reason for denial")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          return interaction.showModal(modal);
        }
      }

      // ---------- EVENTLOG BUTTONS ----------
      if (interaction.customId.startsWith("eventlog_")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const msgId = interaction.message?.id;
        const record = eventLogs.get(String(msgId));
        if (!record) return safeReply(interaction, "❌ This event log is not in the database.");

        if (record.status === "ACCEPTED" || record.status === "DENIED") {
          return safeReply(interaction, "❌ This log is already finalized.");
        }

        // Adjust
        if (interaction.customId === "eventlog_adjust") {
          const modal = new ModalBuilder().setCustomId(`eventlog_adjust_modal:${msgId}`).setTitle("Adjust Event Log Times");

          const startInput = new TextInputBuilder()
            .setCustomId("start")
            .setLabel("New Start (ex: 3:15pm or 15:15)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(record.startStr);

          const endInput = new TextInputBuilder()
            .setCustomId("end")
            .setLabel("New End (ex: 4:00pm or 16:00)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(record.endStr);

          modal.addComponents(new ActionRowBuilder().addComponents(startInput), new ActionRowBuilder().addComponents(endInput));
          return interaction.showModal(modal);
        }

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("eventlog_adjust").setLabel("Adjust").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("eventlog_deny").setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId("eventlog_accept").setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(true)
        );

        // Deny
        if (interaction.customId === "eventlog_deny") {
          record.status = "DENIED";
          record.reviewedById = interaction.user.id;
          record.reviewedAt = new Date().toISOString();
          eventLogs.set(String(msgId), record);
          saveEventLogs();

          pushActivity(interaction.user.id, "EVENTLOG_REVIEW", `Denied event log ${msgId}`, { messageId: msgId });

          const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
          updated.fields = updated.fields || [];
          const idx = updated.fields.findIndex((f) => f.name === "Status");
          const statusValue = `❌ Denied\nReviewed by: ${interaction.user}`;
          if (idx >= 0) updated.fields[idx].value = statusValue;
          else updated.fields.push({ name: "Status", value: statusValue, inline: false });

          await interaction.message.edit({ embeds: [updated], components: [disabledRow] }).catch(() => {});
          return safeReply(interaction, "❌ Event log denied.");
        }

        // Accept ✅ + AUTO TICK ACADEMY EVENT
        if (interaction.customId === "eventlog_accept") {
          const startMin = parseTimeToMinutes(record.startStr);
          const endMinRaw = parseTimeToMinutes(record.endStr);
          if (startMin === null || endMinRaw === null) {
            return safeReply(interaction, "❌ Stored times are invalid — use Adjust first.");
          }

          let endMin = endMinRaw;
          if (endMin < startMin) endMin += 24 * 60;

          const totalMinutes = endMin - startMin;
          const xpEarned = Math.floor(totalMinutes / 15);

          record.status = "ACCEPTED";
          record.reviewedById = interaction.user.id;
          record.reviewedAt = new Date().toISOString();

          if (!record.xpCredited) {
            addXP(record.submitterId, xpEarned);
            record.xpCredited = true;
            record.xpAmount = xpEarned;
          }

          // ✅ AUTO TICK academy event when accepted
          if (String(record.type).toUpperCase() === "ACADEMY") {
            // record.academyEvent is the chosen academy required event name (string)
            const academyEvent = String(record.academyEvent || "").trim();
            if (academyEvent) {
              addAcademyLog(record.submitterId, academyEvent, interaction.user.id, record.proof);
              pushActivity(interaction.user.id, "ACADEMY_TICK", `Auto-ticked academy event "${academyEvent}" for <@${record.submitterId}>`, {
                messageId: msgId,
                academyEvent,
                submitterId: record.submitterId,
              });

              // Optional auto graduate attempt
              const rec = getOrCreateAcademyRecord(record.submitterId);
              const prog = computeAcademyProgress(rec);
              if (prog.total > 0 && prog.done >= prog.total && !rec.graduated) {
                await tryGraduateAcademy(client, interaction, record.submitterId);
              }
            }
          }

          eventLogs.set(String(msgId), record);
          saveEventLogs();

          pushActivity(
            interaction.user.id,
            "EVENTLOG_REVIEW",
            `Accepted event log ${msgId} (+${record.xpAmount ?? xpEarned} XP to <@${record.submitterId}>)`,
            { messageId: msgId, xp: record.xpAmount ?? xpEarned, submitterId: record.submitterId }
          );
          pushActivity(record.submitterId, "XP_EARNED", `Earned +${record.xpAmount ?? xpEarned} XP from event log`, {
            messageId: msgId,
            xp: record.xpAmount ?? xpEarned,
          });

          const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
          updated.fields = updated.fields || [];
          const idx = updated.fields.findIndex((f) => f.name === "Status");
          const statusValue = `✅ Accepted\nReviewed by: ${interaction.user}\nXP credited: ${record.xpAmount ?? xpEarned}`;
          if (idx >= 0) updated.fields[idx].value = statusValue;
          else updated.fields.push({ name: "Status", value: statusValue, inline: false });

          await interaction.message.edit({ embeds: [updated], components: [disabledRow] }).catch(() => {});
          return safeReply(interaction, `✅ Accepted. XP credited: ${record.xpAmount ?? xpEarned}`);
        }
      }
    }

    // =========================
    // Modals
    // =========================
    if (interaction.isModalSubmit()) {
      // EVENTLOG adjust
      if (interaction.customId.startsWith("eventlog_adjust_modal:")) {
        if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ Staff only.");

        const msgId = interaction.customId.split(":")[1];
        const record = eventLogs.get(String(msgId));
        if (!record) return safeReply(interaction, "❌ This event log is not in the database.");
        if (record.status === "ACCEPTED" || record.status === "DENIED") return safeReply(interaction, "❌ This log is already finalized.");

        const newStart = interaction.fields.getTextInputValue("start").trim();
        const newEnd = interaction.fields.getTextInputValue("end").trim();

        const startMin = parseTimeToMinutes(newStart);
        const endMinRaw = parseTimeToMinutes(newEnd);
        if (startMin === null || endMinRaw === null) {
          return safeReply(interaction, "❌ Invalid time format. Use `3:15pm` or `15:15`.");
        }

        let endMin = endMinRaw;
        if (endMin < startMin) endMin += 24 * 60;
        const totalMinutes = endMin - startMin;
        const xp = Math.floor(totalMinutes / 15);

        record.startStr = newStart;
        record.endStr = newEnd;
        eventLogs.set(String(msgId), record);
        saveEventLogs();

        pushActivity(interaction.user.id, "EVENTLOG_ADJUST", `Adjusted event log ${msgId}`, { messageId: msgId });

        const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
        updated.fields = updated.fields || [];

        const replaceField = (name, value) => {
          const i = updated.fields.findIndex((f) => f.name === name);
          if (i >= 0) updated.fields[i].value = value;
        };

        replaceField("Start", newStart);
        replaceField("End", newEnd);
        replaceField("Total active time:", formatDuration(totalMinutes));
        replaceField("XP amount: 1xp every 15 mins", String(xp));

        const idx = updated.fields.findIndex((f) => f.name === "Status");
        const statusValue = `⏳ Pending Review (Adjusted)\nAdjusted by: ${interaction.user}`;
        if (idx >= 0) updated.fields[idx].value = statusValue;
        else updated.fields.push({ name: "Status", value: statusValue, inline: false });

        await interaction.message.edit({ embeds: [updated] }).catch(() => {});
        return safeReply(interaction, `✅ Updated. Total: ${formatDuration(totalMinutes)} | XP: ${xp}`);
      }

      // NOTICE deny
      if (interaction.customId.startsWith("notice_deny_modal:")) {
        if (!canReviewNotices(interaction.member)) return safeReply(interaction, "❌ Staff only.", true);

        const msgId = interaction.customId.split(":")[1];
        const denyReason = interaction.fields.getTextInputValue("deny_reason").trim();
        const rec = notices.get(String(msgId));
        if (!rec) return safeReply(interaction, "❌ Notice not found in database.", true);
        if (rec.status && rec.status !== "PENDING") return safeReply(interaction, "❌ This notice is already finalized.", true);

        rec.status = "DENIED";
        rec.reviewedById = interaction.user.id;
        rec.reviewedAt = new Date().toISOString();
        rec.denyReason = denyReason;
        notices.set(String(msgId), rec);
        saveNotices();

        const updated = structuredClone(interaction.message.embeds[0]?.data ?? {});
        updated.color = 0xe74c3c;
        updated.footer = { text: `❌ Denied by ${interaction.user.username}` };

        await interaction.message.edit({ embeds: [updated], components: [disabledNoticeButtons(msgId)] }).catch(() => {});

        const submitter = await client.users.fetch(rec.submitterId).catch(() => null);
        if (submitter) {
          const by = `${interaction.user}`;
          const msg = `Your notice was denied due to: (${denyReason}) By: ${by}`;
          try {
            await submitter.send(msg);
          } catch {}
        }

        return safeReply(interaction, "❌ Denied + reason sent.", true);
      }
    }

    // =========================
    // Commands
    // =========================
    if (!interaction.isChatInputCommand()) return;

    // /logevent  ✅ start+end required in deploy, enforced here too
    if (interaction.commandName === "logevent") {
      if (isEventlogBlocked(interaction.member)) {
        return safeReply(interaction, "❌ You are blocked from using logevent.", true);
      }
      await safeAck(interaction, true);

      const type = interaction.options.getString("type", true);
      const proof = interaction.options.getString("proof", true);

      const academyUser = interaction.options.getString("academy_member_username", false) || "N/A";
      const academyEvent = interaction.options.getString("academy_event", false) || "N/A";
      const eventName = interaction.options.getString("event_name", false) || "N/A";
      const attendees = interaction.options.getString("attendees", false) || "N/A";

      // ✅ REQUIRED now
      const startStr = interaction.options.getString("start", true);
      const endStr = interaction.options.getString("end", true);

      // Enforce valid time format
      const startMin = parseTimeToMinutes(startStr);
      const endMin = parseTimeToMinutes(endStr);
      if (startMin === null || endMin === null) {
        return safeReply(interaction, "❌ Invalid time format. Use `3:15pm` or `15:15`.", true);
      }

      // Enforce academy_event required if type === ACADEMY
      if (String(type).toUpperCase() === "ACADEMY") {
        const ae = String(academyEvent || "").trim();
        if (!ae || ae === "N/A") {
          return safeReply(interaction, "❌ For Academy logs, you must choose **academy_event**.", true);
        }
      }

      const destId = type === "ACADEMY" ? LOGEVENT_ACADEMY_CHANNEL_ID : LOGEVENT_OTHER_CHANNEL_ID;
      const ch = await getTextChannel(interaction.guild, destId);
      if (!ch) {
        return safeReply(
          interaction,
          `❌ Destination channel not found / bot can’t see it. Check channel ID + permissions.\nChannel ID: ${destId}`,
          true
        );
      }

      // Preview XP calc in embed
      let totalMinutes = 0;
      {
        let end = endMin;
        if (end < startMin) end += 24 * 60;
        totalMinutes = end - startMin;
      }
      const xpPreview = Math.floor(totalMinutes / 15);

      const embed = {
        title: "🧾 Log Event (Pending Review)",
        color: 0xffc107,
        fields: [
          { name: "Submitted by", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: false },
          { name: "Type", value: type, inline: true },
          { name: "Event name", value: eventName, inline: true },
          { name: "Academy member username", value: academyUser, inline: false },
          { name: "Academy required event", value: academyEvent, inline: false },
          { name: "Attendees", value: attendees.slice(0, 900), inline: false },
          { name: "Start", value: startStr, inline: true },
          { name: "End", value: endStr, inline: true },
          { name: "Total active time:", value: formatDuration(totalMinutes), inline: true },
          { name: "XP amount: 1xp every 15 mins", value: String(xpPreview), inline: true },
          { name: "Proof", value: proof.slice(0, 900), inline: false },
          { name: "Status", value: "⏳ Pending Review", inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      const reviewRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eventlog_adjust").setLabel("Adjust").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("eventlog_deny").setLabel("Deny").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("eventlog_accept").setLabel("Accept").setStyle(ButtonStyle.Success)
      );

      const msg = await ch.send({ embeds: [embed], components: [reviewRow] });

      eventLogs.set(String(msg.id), {
        messageId: msg.id,
        submitterId: interaction.user.id,
        type,
        proof,
        academyUser,
        academyEvent,
        eventName,
        attendees,
        startStr,
        endStr,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        xpCredited: false,
        xpAmount: null,
      });
      saveEventLogs();

      pushActivity(interaction.user.id, "LOGEVENT_SUBMIT", `Submitted logevent ${msg.id}`, { messageId: msg.id, type });
      return safeReply(interaction, "✅ Log submitted for staff review.", true);
    }

    // /academyprogress
    if (interaction.commandName === "academyprogress") {
      await safeAck(interaction, true);
      const sub = interaction.options.getSubcommand(true);

      if (sub === "view") {
        const user = interaction.options.getUser("user", false) || interaction.user;
        const rec = getOrCreateAcademyRecord(user.id);
        return interaction.editReply({ embeds: [academyProgressEmbed(user, rec)] });
      }

      if (!canManageAcademy(interaction.member)) {
        return safeReply(interaction, "❌ Staff only.", true);
      }

      if (sub === "setdept") {
        const user = interaction.options.getUser("user", true);
        const dept = interaction.options.getString("dept", true);
        const rec = getOrCreateAcademyRecord(user.id);
        rec.dept = dept;
        academy.set(String(user.id), rec);
        saveAcademy();
        return safeReply(interaction, `✅ Set **${user.tag}** academy dept to **${dept.toUpperCase()}**.`, true);
      }

      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const event = interaction.options.getString("event", true);
        const proof = interaction.options.getString("proof", false) || null;

        const rec = addAcademyLog(user.id, event, interaction.user.id, proof);
        const prog = computeAcademyProgress(rec);

        const msg = `✅ Logged **${event}** for **${user.tag}**.\nProgress: **${prog.done}/${prog.total} (${prog.pct}%)**`;
        return safeReply(interaction, msg, true);
      }

      if (sub === "graduate") {
        const user = interaction.options.getUser("user", true);
        const result = await tryGraduateAcademy(client, interaction, user.id);
        if (!result.ok) return safeReply(interaction, `❌ ${result.msg}`, true);
        return safeReply(interaction, `🎓 ${result.msg}`, true);
      }
    }

    // /xp
    if (interaction.commandName === "xp") {
      const target = interaction.options.getUser("user", false);
      if (target && target.id !== interaction.user.id && !isCaseStaff(interaction.member)) {
        return safeReply(interaction, "❌ You can only view your own XP.");
      }
      const who = target ?? interaction.user;

      await safeAck(interaction, false);

      const totalXp = getXP(who.id);
      const rankInfo = computeXpRank(totalXp);

      const robloxId = await getRoWifiRobloxId(who.id);
      const robloxUser = robloxId ? await getRobloxUsername(robloxId) : null;
      const robloxLine = robloxId && robloxUser ? `[${robloxUser}](https://www.roblox.com/users/${robloxId}/profile)` : "Unknown";

      const pctText = `${rankInfo.pct.toFixed(1)}%`;
      const bar = progressBar(rankInfo.pct);

      const progressLine = rankInfo.maxed
        ? `**${rankInfo.current}** → **MAX**\n${bar} 100.0%\n✅ Max rank`
        : `**${rankInfo.current}** → **${rankInfo.next}**\n${bar} ${pctText}\n**${rankInfo.needed} XP** needed`;

      const embed = {
        color: 0x3498db,
        author: { name: `${who.username}`, icon_url: who.displayAvatarURL({ size: 128 }) },
        fields: [
          { name: "Roblox Account", value: robloxLine, inline: true },
          { name: "Current Rank", value: rankInfo.current, inline: true },
          { name: "Total XP", value: String(totalXp), inline: true },
          { name: "Rank Progress", value: progressLine, inline: false },
        ],
      };
      return interaction.editReply({ embeds: [embed] });
    }

    // /ranks
    if (interaction.commandName === "ranks") {
      const lines = Object.entries(RANKS).map(([id, name]) => `**Rank ${id}** — ${name}`).join("\n");
      return interaction.reply({
        embeds: [{ title: "📜 Aegis Rank List", description: lines, color: 0x2f3136 }],
      });
    }

    // /ranklock
    if (interaction.commandName === "ranklock") {
      if (!hasAnyRole(interaction.member, [DISCIPLINE_ROLE_ID, OWNER_ROLE_ID])) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const rankId = interaction.options.getInteger("rank", true);
      if (!RANKS[rankId]) return safeReply(interaction, "❌ Invalid rank ID.");

      setStaffRankLock(user.id, rankId, interaction.user.id);
      pushActivity(interaction.user.id, "STAFF_RANKLOCK", `Rank-locked ${user.username} to ${RANKS[rankId]}`, {
        targetId: user.id,
        maxRankId: rankId,
      });

      return safeReply(interaction, `🔒 **${user.tag}** locked to **${RANKS[rankId]}**`, false);
    }

if (interaction.commandName === "setrank") {
  if (!hasAnyRole(interaction.member, [DISCIPLINE_ROLE_ID, OWNER_ROLE_ID])) {
    return safeReply(interaction, "❌ Unauthorized", true);
  }

  await safeAck(interaction);

  const user = interaction.options.getUser("user", true);
  const rankId = interaction.options.getInteger("rank", true);
  if (!RANKS[rankId]) {
    return safeReply(interaction, "❌ Invalid rank ID.");
  }

  const lock = getStaffRankLock(user.id);
  if (lock && Number(rankId) > Number(lock.maxRankId)) {
    return safeReply(
      interaction,
      `❌ USER IS RANK LOCKED TO: **${RANKS[lock.maxRankId]}**`
    );
  }

  // ================= INTERNAL STAFF RANK =================
  setStaffRank(user.id, rankId, interaction.user.id);
  pushActivity(
    interaction.user.id,
    "STAFF_SETRANK",
    `Set staff rank for ${user.username} to ${RANKS[rankId]}`,
    { targetId: user.id, rankId }
  );

  // ================= DISCORD ROLE UPDATE =================
  let discordResult = "Skipped (no Discord role mapping).";
  let success = false;

  try {
    const member = await interaction.guild.members.fetch(user.id);

    const newRoleId = DISCORD_RANK_ROLE_MAP[String(rankId)];
    if (!newRoleId) {
      discordResult = `Skipped: No Discord role mapped for rank ${rankId}.`;
    } else {
      const role =
        interaction.guild.roles.cache.get(newRoleId) ||
        (await interaction.guild.roles.fetch(newRoleId).catch(() => null));

      if (!role) {
        discordResult = `❌ Failed: Discord role not found (roleId=${newRoleId}).`;
      } else {
        // remove other staff rank roles
        const allRankRoleIds = new Set(Object.values(DISCORD_RANK_ROLE_MAP));
        const toRemove = member.roles.cache.filter(
          r => allRankRoleIds.has(r.id) && r.id !== role.id
        );

        if (toRemove.size) {
          await member.roles.remove(toRemove.map(r => r.id));
        }

        await member.roles.add(role.id);
        success = true;
        discordResult = `✅ Updated Discord role to **${role.name}**`;
      }
    }
  } catch (e) {
    discordResult = `❌ Failed: ${String(e.message || e).slice(0, 200)}`;
  }

 // ================= ROBLOX RANK =================
let robloxResult = "Skipped (no mapping / missing RoWifi / missing Open Cloud env).";
let robloxLine = "Unknown";

try {
  const robloxId = await getRoWifiRobloxId(user.id);
  const robloxUser = robloxId ? await getRobloxUsername(robloxId) : null;
  robloxLine =
    robloxId && robloxUser
      ? `[${robloxUser}](https://www.roblox.com/users/${robloxId}/profile)`
      : "Unknown";

  const roleId = RANK_TO_ROBLOX_ROLE_MAP[String(rankId)];

  // ✅ Only try membership lookup if we actually have a robloxId
  const membershipId = robloxId ? await findMembershipIdByUserId(robloxId) : null;

  // ✅ Debug safely (everything exists now)
  console.log("DEBUG Roblox:", {
    groupId: ROBLOX_GROUP_ID,
    staffRankId: rankId,
    mappedRoleId: roleId ?? null,
    robloxId: robloxId ?? null,
    membershipId: membershipId ?? null,
  });

  if (!robloxId) robloxResult = "Failed: Target has no RoWifi Roblox account linked.";
  else if (!ROBLOX_GROUP_ID || !ROBLOX_OPEN_CLOUD_KEY)
    robloxResult = "Failed: Missing ROBLOX_GROUP_ID or ROBLOX_OPEN_CLOUD_KEY.";
  else if (!roleId)
    robloxResult = `Failed: No Roblox role mapping for staff rank ${rankId}.`;
  else if (!membershipId)
    robloxResult = "Failed: Roblox user is not in the group (no membership found).";
  else {
    await setMembershipRole(membershipId, roleId);
    robloxResult = `✅ Updated Roblox group role (roleId=${roleId})`;
  }
} catch (e) {
  robloxResult = `Failed: ${String(e.message || e).slice(0, 300)}`;
}

  // ================= LOG =================
  await logRankAction(interaction.guild, {
    success,
    action: `SetRank -> ${RANKS[rankId]}`,
    moderator: `${interaction.user}`,
    targetDiscord: `${user} (ID: ${user.id})`,
    robloxLine,
    result: `Discord: ${discordResult} | Roblox: ${robloxResult}`,
  });

  return safeReply(
    interaction,
    `✅ Set **${user.tag}** to **${RANKS[rankId]}**\n${discordResult}\nRoblox rank: ${robloxResult}`,
    false
  );
}


    // /notice
    if (interaction.commandName === "notice") {
      await safeAck(interaction, true);

      const noticeType = interaction.options.getString("type", true);
      const reason = interaction.options.getString("reason", true);
      const leaveDateStr = interaction.options.getString("leave_date", true);
      const returnDateStrRaw = interaction.options.getString("return_date", true);

      const leaveDt = parseDMY(leaveDateStr);
      if (!leaveDt) return safeReply(interaction, "❌ Leave date must be **DD/MM/YYYY**.", true);

      const returnDateStr = String(returnDateStrRaw || "").trim();
      const returnIsNA = returnDateStr.toLowerCase() === "n/a" || returnDateStr.toLowerCase() === "na";

      let returnDt = null;
      if (!returnIsNA) {
        returnDt = parseDMY(returnDateStr);
        if (!returnDt) return safeReply(interaction, "❌ Return date must be **DD/MM/YYYY** or **N/A** (leave only).", true);
        if (returnDt.getTime() < leaveDt.getTime()) return safeReply(interaction, "❌ Return date can’t be before leave date.", true);
      } else {
        if (noticeType !== "LEAVE") return safeReply(interaction, "❌ Only **Leave** notices can use **N/A** for return date.", true);
      }

      // 7-day rule for Leave
      if (noticeType === "LEAVE") {
        const today = utcToday();
        const diffDays = daysBetweenUTC(today, leaveDt);
        if (diffDays < 7) return safeReply(interaction, "❌ **Leave** notices must be submitted **at least 7 days in advance**.", true);
      }

      // Pull Roblox username from RoWifi
      const robloxId = await getRoWifiRobloxId(interaction.user.id);
      const robloxUsername = robloxId ? (await getRobloxUsername(robloxId)) : null;

      const dest = await getTextChannel(interaction.guild, NOTICE_CHANNEL_ID);
      if (!dest) return safeReply(interaction, "❌ Notice channel not found / bot can’t see it.", true);

      const payload = {
        submitterId: interaction.user.id,
        robloxUsername: robloxUsername || "Unknown (not verified)",
        robloxId: robloxId || null,
        noticeType,
        reason: String(reason).slice(0, 900),
        leaveDate: leaveDateStr,
        returnDate: returnIsNA ? "N/A" : returnDateStr,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };

      const msg = await dest.send({
        content: `<@&${NOTICE_PING_ROLE_ID}>`,
        embeds: [buildNoticeEmbed(payload)],
        components: [noticeButtons("pending")],
      });

      notices.set(String(msg.id), payload);
      saveNotices();

      await msg.edit({ components: [noticeButtons(msg.id)] }).catch(() => {});
      return safeReply(interaction, "✅ Notice submitted for review.", true);
    }

    // =======================================================
    // ✅ KEEP ALL YOUR OTHER COMMANDS (stubs included)
    // =======================================================

    // These commands are still registered in deploy-commands.js.
    // If you already had full logic for them in your old index.js,
    // paste your old handlers into these sections and you’re done.

 // =======================================================
    // ✅ UPDATED: /history
    // - Shows cases + casefiles
    // - If redacted + viewer not full access => FULL BLACKOUT with REDACT TAG
    // =======================================================
    if (interaction.commandName === "history") {
      await safeAck(interaction, false); // public history output
      const user = interaction.options.getUser("user", false) ?? interaction.user;
      const viewer = interaction.member;
      const viewerCanUnredact = canViewUnredacted(viewer) || isCaseStaff(viewer);

      const userCasefiles = Array.from(casefiles.values())
        .map(ensureCasefileShape)
        .filter((c) => String(c.targetDiscordId) === String(user.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const userCases = Array.from(cases.values())
        .map(ensureCaseShape)
        .filter((c) => String(c.caseAgainstId) === String(user.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const casefileLines = userCasefiles.length
        ? userCasefiles.map((cf) => {
            const redAll = !!cf.redactions?.all;
            if (redAll && !viewerCanUnredact) return `${REDACT_TAG}`;
            const issuer = cf.submittedById ? `<@${cf.submittedById}>` : "Unknown";
            const signOff = cf.signedOffBy || "Unknown";
            const status = cf.status || "ACTIVE";

            const doc = (!viewerCanUnredact && cf.redactions?.fields?.doc) ? PRIV_REDACT : (cf.casefileDoc || "N/A");
            const punish = (!viewerCanUnredact && cf.redactions?.fields?.punishment) ? PRIV_REDACT : (cf.punishmentGiven || "N/A");
            const issuedBy = (!viewerCanUnredact && cf.redactions?.fields?.issuer) ? PRIV_REDACT : issuer;
            const sign = (!viewerCanUnredact && cf.redactions?.fields?.signOff) ? PRIV_REDACT : signOff;
            const st = (!viewerCanUnredact && cf.redactions?.fields?.status) ? PRIV_REDACT : status;

            return `• **${cf.casefileId}** | Issuer: **${issuedBy}** | Sign-off: **${sign}** | Status: **${st}**\n  Punishment: **${punish}**\n  Doc: ${doc}`;
          }).join("\n──────────\n")
        : "None";

      const caseLines = userCases.length
        ? userCases.map((c) => {
            const redAll = !!c.redactions?.all;
            if (redAll && !viewerCanUnredact) return `${REDACT_TAG}`;
            const issuer = c.createdById ? `<@${c.createdById}>` : "Unknown";
            const status = c.status || "ACTIVE";
            const reasons = (!viewerCanUnredact && c.redactions?.fields?.reasons) ? PRIV_REDACT : (c.reasons || "N/A");
            const st = (!viewerCanUnredact && c.redactions?.fields?.status) ? PRIV_REDACT : status;
            const issuedBy = (!viewerCanUnredact && c.redactions?.fields?.issuer) ? PRIV_REDACT : issuer;

            return `• **${c.caseId}** | Issued By: **${issuedBy}** | Status: **${st}**\n  Reasons: ${reasons}`;
          }).join("\n──────────\n")
        : "None";

      return interaction.editReply({
        embeds: [
          {
            title: "📂 User History",
            description: `**User:** ${user} (ID: ${user.id})\n\n**Casefiles:**\n${casefileLines}\n\n**Cases:**\n${caseLines}`,
            color: 0x5865f2,
            footer: { text: viewerCanUnredact ? "Unredacted access" : "Public view (redactions enforced)" },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }


 // =======================================================
    // ✅ UPDATED: /redact (expanded)
    // Restriction: Discipline / High Command
    // type: case OR casefile
    // fields: doc, issuer, signoff, status, punishment, reasons, evidence, all
    // =======================================================
    if (interaction.commandName === "redact") {
      if (!isHighCommand(interaction.member) && !hasRole(interaction.member, DISCIPLINE_ROLE_ID)) {
        return safeReply(interaction, "❌ No permission.");
      }
      await safeAck(interaction);

      const targetType = interaction.options.getString("type", true); // "case" or "casefile"
      const targetId = interaction.options.getString("id", true).trim().toUpperCase();
      const field = interaction.options.getString("field", true); // one of choices

      const applyField = (obj) => {
        obj = obj || {};
        if (!obj.redactions) obj.redactions = { all: false, fields: {} };
        if (!obj.redactions.fields) obj.redactions.fields = {};

        if (field === "all") {
          obj.redactions.all = true;
          obj.redactions.fields = {};
        } else {
          obj.redactions.fields[field] = true;
        }
        return obj;
      };

      if (targetType === "case") {
        const c = cases.get(targetId);
        if (!c) return safeReply(interaction, `❌ Case not found: ${targetId}`);
        const updated = applyField(ensureCaseShape(c));
        cases.set(targetId, updated);
        saveCases();
        await logToCasesChannel(interaction.guild, `🔏 Redaction applied\nType: CASE\nID: ${targetId}\nField: ${field}\nBy: ${interaction.user}`);
        pushActivity(interaction.user.id, "REDACT_CASE", `Redacted case ${targetId} (${field})`, { id: targetId, field });
        return safeReply(interaction, `✅ Redacted **CASE ${targetId}** field: **${field}**`);
      }

      if (targetType === "casefile") {
        const cf = casefiles.get(targetId);
        if (!cf) return safeReply(interaction, `❌ Casefile not found: ${targetId}`);
        const updated = applyField(ensureCasefileShape(cf));
        casefiles.set(targetId, updated);
        saveCasefiles();
        await logToCasesChannel(interaction.guild, `🔏 Redaction applied\nType: CASEFILE\nID: ${targetId}\nField: ${field}\nBy: ${interaction.user}`);
        pushActivity(interaction.user.id, "REDACT_CASEFILE", `Redacted casefile ${targetId} (${field})`, { id: targetId, field });
        return safeReply(interaction, `✅ Redacted **CASEFILE ${targetId}** field: **${field}**`);
      }

      return safeReply(interaction, "❌ Invalid type.");
    }




    if (interaction.commandName === "apply") {
  await safeAck(interaction, true);

  const dept = interaction.options.getString("department", true);
  const applicant = interaction.user;

  // Build questions list
  let questions = [];
  if (dept === "ALL") {
    questions = shuffle([
      ...APPLY_QUESTIONS.SECURITY,
      ...APPLY_QUESTIONS.MEDICAL,
      ...APPLY_QUESTIONS.ACADEMY,
      ...APPLY_QUESTIONS.ADMIN_DISC,
    ]);
  } else {
    questions = APPLY_QUESTIONS[dept] ? [...APPLY_QUESTIONS[dept]] : [];
  }

  if (!questions.length) return safeReply(interaction, "❌ No questions found for that department.");

  // DM interview
  let dm;
  try {
    dm = await applicant.createDM();
    await dm.send(`📩 **Application Started**\nDepartment: **${dept}**\nAnswer the following questions one by one.`);
  } catch {
    return safeReply(interaction, "❌ I couldn’t DM you. Please enable DMs from this server and try again.");
  }

  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await dm.send(`**Q${i + 1}/${questions.length}:** ${q}`);

    const collected = await dm.awaitMessages({
      max: 1,
      time: 10 * 60 * 1000,
      filter: (m) => m.author.id === applicant.id,
    }).catch(() => null);

    const msg = collected?.first();
    if (!msg) {
      await dm.send("⏱️ Application timed out. Run `/apply` again when ready.");
      return safeReply(interaction, "⏱️ Timed out in DMs. Try again.");
    }

    answers.push({ question: q, answer: msg.content.slice(0, 1500) });
  }

  const applicationId = generateApplicationId();
  const record = {
    applicationId,
    userId: applicant.id,
    userTag: applicant.username,
    dept,
    createdAt: new Date().toISOString(),
    status: "PENDING",
    answers,
  };

  applications.set(applicationId, record);
  saveApplications();

  // Send to staff review channel
  const ch = await getTextChannel(interaction.guild, APPLICATIONS_CHANNEL_ID);
  if (ch) {
    const lines = answers
      .map((a, idx) => `**Q${idx + 1}:** ${a.question}\n**A:** ${a.answer}`)
      .join("\n\n");

    await ch.send({
      embeds: [
        {
          title: `📝 New Application (${applicationId})`,
          color: 0x00b894,
          fields: [
            { name: "Applicant", value: `${applicant} (ID: ${applicant.id})`, inline: false },
            { name: "Department", value: dept, inline: true },
            { name: "Submitted", value: record.createdAt, inline: true },
            { name: "Responses", value: lines.slice(0, 4000), inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  try { await dm.send(`✅ Submitted! Your application ID is **${applicationId}**.`); } catch {}

  return safeReply(interaction, `✅ Application submitted! Check your DMs. (ID: **${applicationId}**)`, true);
}



    // =======================================================
    // ✅ NEW: /wipedata (restricted)
    // data: events, cases, casefiles, punishments, all
    // logs to cases channel
    // =======================================================
    if (interaction.commandName === "wipedata") {
      if (!hasRole(interaction.member, DISCIPLINE_ROLE_ID)) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const type = interaction.options.getString("data", true); // events/cases/casefiles/punishments/all

      const uid = String(user.id);
      let wiped = [];

      const wipeCases = () => {
        const keys = [];
        for (const [k, v] of cases.entries()) {
          if (String(v.caseAgainstId) === uid) keys.push(k);
        }
        keys.forEach((k) => cases.delete(k));
        if (keys.length) {
          saveCases();
          wiped.push(`Cases(${keys.length})`);
        }
      };

      const wipeCasefiles = () => {
        const keys = [];
        for (const [k, v] of casefiles.entries()) {
          if (String(v.targetDiscordId) === uid) keys.push(k);
        }
        keys.forEach((k) => casefiles.delete(k));
        if (keys.length) {
          saveCasefiles();
          wiped.push(`Casefiles(${keys.length})`);
        }
      };

      const wipeEvents = () => {
        // eventLogs keyed by messageId, so we wipe by submitterId inside object
        const keys = [];
        for (const [k, v] of eventLogs.entries()) {
          if (String(v.submitterId) === uid) keys.push(k);
        }
        keys.forEach((k) => eventLogs.delete(k));
        if (keys.length) {
          saveEventLogs();
          wiped.push(`EventLogs(${keys.length})`);
        }
      };

      const wipePunishments = () => {
        // punishments are cases in your codebase
        wipeCases();
      };

      if (type === "events") wipeEvents();
      else if (type === "cases") wipeCases();
      else if (type === "casefiles") wipeCasefiles();
      else if (type === "punishments") wipePunishments();
      else if (type === "all") {
        wipeEvents();
        wipeCasefiles();
        wipeCases();
        // optional: wipe XP/appeals/activity for user too:
        xpStore.delete(uid); saveXP(); wiped.push("XP");
        appeals.delete(uid); saveAppeals(); wiped.push("Appeals");
        activityStore.delete(uid); saveActivity(); wiped.push("Activity");
      } else {
        return safeReply(interaction, "❌ Invalid data type.");
      }

      await logToCasesChannel(interaction.guild, `🧹 Data wipe\nUser: ${user.tag} (${user.id})\nType: ${type}\nWiped: ${wiped.join(", ") || "Nothing found"}\nBy: ${interaction.user}`);

      pushActivity(interaction.user.id, "WIPE_DATA", `Wiped ${type} for ${user.username}`, { targetId: user.id, type, wiped });

      return safeReply(interaction, `✅ Data wiped: **${type}** (${wiped.join(", ") || "Nothing found"})`, false);
    }



    // =======================================================
    // ✅ NEW: /revokecasefile (delete OR appealed)
    // logs to cases channel
    // =======================================================
    if (interaction.commandName === "revokecasefile") {
      if (!hasRole(interaction.member, DISCIPLINE_ROLE_ID)) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const action = interaction.options.getString("type", true); // delete / appealed
      const reason = interaction.options.getString("reason", true);

      const latest = findLatestCasefileFor(user.id);
      if (!latest) return safeReply(interaction, `❌ No casefile found for ${user}.`);

      const cf = ensureCasefileShape(latest);

      if (action === "delete") {
        casefiles.delete(cf.casefileId);
        saveCasefiles();
        await logToCasesChannel(interaction.guild, `🗑️ Casefile deleted\nUser: ${user.tag} (${user.id})\nCasefile: ${cf.casefileId}\nReason: ${reason}\nBy: ${interaction.user}`);
        pushActivity(interaction.user.id, "CASEFILE_DELETE", `Deleted casefile ${cf.casefileId} for ${user.username}`, { casefileId: cf.casefileId, reason });
        return safeReply(interaction, `✅ Casefile **DELETED**: **${cf.casefileId}**`, false);
      }

      if (action === "appealed") {
        cf.status = "APPEALED";
        cf.appealedAt = new Date().toISOString();
        cf.appealedById = interaction.user.id;
        cf.appealReason = reason;
        casefiles.set(cf.casefileId, cf);
        saveCasefiles();

        await logToCasesChannel(interaction.guild, `🔁 Casefile appealed\nUser: ${user.tag} (${user.id})\nCasefile: ${cf.casefileId}\nReason: ${reason}\nBy: ${interaction.user}`);
        pushActivity(interaction.user.id, "CASEFILE_APPEAL_MARK", `Marked casefile ${cf.casefileId} as APPEALED for ${user.username}`, { casefileId: cf.casefileId, reason });
        return safeReply(interaction, `✅ Casefile **APPEALED**: **${cf.casefileId}**`, false);
      }

      return safeReply(interaction, "❌ Invalid type.");
    }

    // =======================================================
    // ✅ NEW: /botset (owner only)
    // =======================================================
    if (interaction.commandName === "botset") {
      if (!hasRole(interaction.member, OWNER_ROLE_ID)) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await safeAck(interaction);

      const bio = interaction.options.getString("bio", false);
      const username = interaction.options.getString("username", false);

      if (bio) client.user.setActivity(bio);
      if (username) await client.user.setUsername(username);

      pushActivity(interaction.user.id, "BOTSET", "Updated bot settings", { bio: !!bio, username: !!username });

      return safeReply(interaction, "✅ Bot updated.", false);
    }

    // =======================================================
    // ✅ NEW: /refreshcmds (owner only)
    // =======================================================
    if (interaction.commandName === "refreshcmds") {
      if (!hasRole(interaction.member, OWNER_ROLE_ID)) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await safeAck(interaction);
      try {
        const out = await refreshCommands();
        pushActivity(interaction.user.id, "REFRESHCMDS", "Refreshed slash commands", {});
        return safeReply(interaction, `🔄 Commands refreshed.\n${String(out).slice(0, 1500)}`, false);
      } catch (e) {
        return safeReply(interaction, `❌ Refresh failed: ${String(e.message || e).slice(0, 1500)}`);
      }
    }

    // =======================================================
    // ✅ NEW: /emergancyshutdown (owner only)
    // =======================================================
    if (interaction.commandName === "emergancyshutdown") {
      if (!hasRole(interaction.member, OWNER_ROLE_ID)) {
        return safeReply(interaction, "❌ Unauthorized", true);
      }
      await interaction.reply("🚨 **BOT SHUTTING DOWN**");
      process.exit(0);
    }

    // =======================================================
    // Everything below here is your existing commands
    // (kept, except bug fix in blacklistrevoke)
    // =======================================================

    // ---------- REVOKEPUNISHMENT ----------
    if (interaction.commandName === "revokepunishment") {
      if (!isHighCommand(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);
      const caseId = interaction.options.getString("case_id", true).trim().toUpperCase();
      const reason = interaction.options.getString("reason", true);

      const found = cases.get(caseId);
      if (!found) return safeReply(interaction, `❌ Case not found: ${caseId}`);

      const c = ensureCaseShape(found);
      c.revoked = true;
      c.revokedAt = new Date().toISOString();
      c.revokedById = interaction.user.id;
      c.revokeReason = reason;
      c.status = "REVOKED";
      cases.set(caseId, c);
      saveCases();

      pushActivity(interaction.user.id, "PUNISHMENT_REVOKE", `Revoked punishment ${caseId}`, { caseId, reason });

      const ch = await getTextChannel(interaction.guild, CASES_CHANNEL_ID);
      if (ch) {
        await ch.send({
          embeds: [
            {
              title: "✅ Punishment Revoked",
              color: 0x2ecc71,
              fields: [
                { name: "Case ID", value: caseId, inline: false },
                { name: "Against", value: `<@${c.caseAgainstId}>`, inline: false },
                { name: "Revoked by", value: `${interaction.user}`, inline: false },
                { name: "Reason", value: reason, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
      return safeReply(interaction, `✅ Case **${caseId}** has been revoked.`);
    }

    // ---------- CASEFILE ----------
    if (interaction.commandName === "casefile") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const targetUser = interaction.options.getUser("user", true);
      const casefileDoc = interaction.options.getString("casefile_doc", true);
      const punishment = interaction.options.getString("punishment_given", true);
      const signedOffBy = interaction.options.getString("signed_off_by", true);

      const robloxId = await getRoWifiRobloxId(targetUser.id);
      const robloxUser = robloxId ? await getRobloxUsername(robloxId) : null;

      const channel = await getTextChannel(interaction.guild, CASEFILE_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Casefile channel not found.");

      const casefileId = genId("CF");
      const entry = ensureCasefileShape({
        casefileId,
        createdAt: new Date().toISOString(),
        submittedById: interaction.user.id,
        targetDiscordId: targetUser.id,
        targetDiscordTag: targetUser.username,
        robloxId: robloxId || null,
        robloxUser: robloxUser || null,
        punishmentGiven: punishment,
        casefileDoc,
        signedOffBy,
        status: "ACTIVE",
      });

      casefiles.set(casefileId, entry);
      saveCasefiles();

      pushActivity(interaction.user.id, "CASEFILE_SUBMIT", `Submitted casefile ${casefileId} for ${targetUser.username}`, {
        casefileId,
        targetId: targetUser.id,
      });

      const embed = {
        title: "📁 Casefile Submitted",
        color: 0xff0000,
        fields: [
          { name: "User who submitted", value: `${interaction.user}`, inline: false },
          { name: "Sign Off Officer", value: signedOffBy, inline: false },
          { name: "Casefiled user", value: `${targetUser}`, inline: false },
          { name: "Roblox user", value: robloxUser ?? "Unknown (not verified)", inline: true },
          { name: "Roblox ID", value: robloxId ?? "Unknown", inline: true },
          { name: "Punishment given", value: punishment, inline: false },
          { name: "Casefile doc", value: casefileDoc, inline: false },
          { name: "Casefile ID", value: casefileId, inline: false },
        ],
        timestamp: entry.createdAt,
      };
      await channel.send({ embeds: [embed] });
      return safeReply(interaction, "✅ Casefile submitted.");
    }

    // ---------- REPORT ----------
    if (interaction.commandName === "report") {
      await safeAck(interaction);
      const targetUser = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const proof = interaction.options.getString("proof", true);

      const channel = await getTextChannel(interaction.guild, REPORT_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Report channel not found.");

      const reportId = `R-${Date.now().toString(36).toUpperCase()}`;
      pushActivity(interaction.user.id, "REPORT", `Submitted report ${reportId} on ${targetUser.username}`, { reportId, targetId: targetUser.id });

      const embed = {
        title: `🚨 New Report (${reportId})`,
        color: 0xffa500,
        fields: [
          { name: "Reporter", value: `${interaction.user}`, inline: false },
          { name: "Reported", value: `${targetUser}`, inline: false },
          { name: "Reason", value: reason, inline: false },
          { name: "Proof", value: proof, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };
      await channel.send({ embeds: [embed] });
      return safeReply(interaction, `✅ Report submitted. (ID: ${reportId})`);
    }

    // ---------- CREATECASE ----------
    if (interaction.commandName === "createcase") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const reportId = interaction.options.getString("report_id", true);
      const caseAgainst = interaction.options.getUser("case_against", true);
      const reasons = interaction.options.getString("reasons", true);

      const channel = await getTextChannel(interaction.guild, CASES_CHANNEL_ID);
      if (!channel) return safeReply(interaction, "❌ Cases channel not found.");

      const caseId = generateCaseId();
      const caseObj = ensureCaseShape({
        caseId,
        reportId,
        caseAgainstId: caseAgainst.id,
        reasons,
        evidence: [],
        status: "ACTIVE",
        createdById: interaction.user.id,
        createdAt: new Date().toISOString(),
        appealedAt: null,
        appealedById: null,
        revoked: false,
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
      });

      cases.set(caseId, caseObj);
      saveCases();

      pushActivity(interaction.user.id, "CASE_CREATE", `Created case ${caseId} against ${caseAgainst.username}`, { caseId, targetId: caseAgainst.id });

      const embed = {
        title: `⚖️ Staff Case Created (${caseId})`,
        color: 0x7b2cff,
        fields: [
          { name: "Created by", value: `${interaction.user}`, inline: false },
          { name: "Report ID", value: reportId, inline: false },
          { name: "Case against", value: `${caseAgainst}`, inline: false },
          { name: "Reasons", value: reasons, inline: false },
          { name: "Status", value: caseObj.status, inline: false },
        ],
        timestamp: caseObj.createdAt,
      };
      await channel.send({ embeds: [embed] });
      return safeReply(interaction, `✅ Case created. CaseID: ${caseId}`);
    }

    // ---------- VIEWCASE ----------
    if (interaction.commandName === "viewcase") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const caseIdInput = interaction.options.getString("case_id", true).trim().toUpperCase();
      const found = cases.get(caseIdInput);
      if (!found) return safeReply(interaction, `❌ Case not found: ${caseIdInput}`);

      const c = ensureCaseShape(found);

      const evidenceLines =
        Array.isArray(c.evidence) && c.evidence.length
          ? c.evidence.slice(-10).map((e, i) => `${i + 1}. ${e.link} (by <@${e.addedById}>)`).join("\n")
          : "None";

      const embed = {
        title: `📄 Case Details (${c.caseId})`,
        color: 0x00b3ff,
        fields: [
          { name: "Created by", value: `<@${c.createdById}>`, inline: false },
          { name: "Report ID", value: c.reportId, inline: false },
          { name: "Case against", value: `<@${c.caseAgainstId}>`, inline: false },
          { name: "Reasons", value: c.reasons, inline: false },
          { name: "Evidence (latest)", value: evidenceLines, inline: false },
          { name: "Status", value: c.status || "ACTIVE", inline: false },
          { name: "Created at", value: c.createdAt, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };
      return interaction.editReply({ embeds: [embed] });
    }

    // ---------- ADDEVIDENCE ----------
    if (interaction.commandName === "addevidence") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const caseIdInput = interaction.options.getString("case_id", true).trim().toUpperCase();
      const evidenceLink = interaction.options.getString("evidence_link", true).trim();
      const found = cases.get(caseIdInput);
      if (!found) return safeReply(interaction, `❌ Case not found: ${caseIdInput}`);

      const c = ensureCaseShape(found);
      if (!Array.isArray(c.evidence)) c.evidence = [];
      c.evidence.push({ link: evidenceLink, addedById: interaction.user.id, addedAt: new Date().toISOString() });
      cases.set(caseIdInput, c);
      saveCases();

      pushActivity(interaction.user.id, "EVIDENCE_ADD", `Added evidence to ${caseIdInput}`, { caseId: caseIdInput });

      const channel = await getTextChannel(interaction.guild, CASES_CHANNEL_ID);
      if (channel) {
        await channel.send({
          embeds: [
            {
              title: `🧾 Evidence Added (${c.caseId})`,
              color: 0x00ff99,
              fields: [
                { name: "Case ID", value: c.caseId, inline: false },
                { name: "Added by", value: `${interaction.user}`, inline: false },
                { name: "Evidence link", value: evidenceLink, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
      return safeReply(interaction, "✅ Evidence added.");
    }

    // ---------- BLACKLIST ADD ----------
    if (interaction.commandName === "blacklistadd") {
      if (!isBlacklistManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const caseId = interaction.options.getString("case_id", true).trim().toUpperCase();

      blacklist.set(user.id, {
        userId: user.id,
        userTag: user.username,
        reason,
        caseId,
        addedById: interaction.user.id,
        addedAt: new Date().toISOString(),
        revoked: false,
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
      });
      saveBlacklist();

      pushActivity(interaction.user.id, "BLACKLIST_ADD", `Blacklisted ${user.username} (Case ${caseId})`, { targetId: user.id, caseId });

      await logBlacklist(
        interaction.guild,
        "⛔ Blacklist Added",
        [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Reason", value: reason, inline: false },
          { name: "Case ID", value: caseId, inline: false },
          { name: "Added by", value: `${interaction.user}`, inline: false },
        ],
        0xff0000
      );
      return safeReply(interaction, `✅ Blacklisted ${user} (Case: ${caseId}).`);
    }

    // ---------- BLACKLIST VIEW ----------
    if (interaction.commandName === "blacklistview") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const entry = blacklist.get(user.id);
      if (!entry) return safeReply(interaction, `❌ No blacklist record for ${user}.`);

      const embed = {
        title: "⛔ Blacklist Record",
        color: entry.revoked ? 0x888888 : 0xff0000,
        fields: [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Status", value: entry.revoked ? "REVOKED" : "ACTIVE", inline: true },
          { name: "Case ID", value: entry.caseId || "N/A", inline: true },
          { name: "Reason", value: entry.reason || "N/A", inline: false },
          { name: "Added by", value: `<@${entry.addedById}>`, inline: true },
          { name: "Added at", value: entry.addedAt || "N/A", inline: true },
          { name: "Revoked by", value: entry.revokedById ? `<@${entry.revokedById}>` : "N/A", inline: true },
          { name: "Revoked at", value: entry.revokedAt || "N/A", inline: true },
          { name: "Revoke reason", value: entry.revokeReason || "N/A", inline: false },
        ],
        timestamp: new Date().toISOString(),
      };
      return interaction.editReply({ embeds: [embed] });
    }

    // ---------- BLACKLIST REVOKE (FIXED) ----------
    if (interaction.commandName === "blacklistrevoke") {
      if (!isBlacklistManager(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const user = interaction.options.getUser("user", true);
      const revokeReason = interaction.options.getString("reason", true); // ✅ FIXED

      const entry = blacklist.get(user.id);
      if (!entry) return safeReply(interaction, `❌ No blacklist record for ${user}.`);

      entry.revoked = true;
      entry.revokedAt = new Date().toISOString();
      entry.revokedById = interaction.user.id;
      entry.revokeReason = revokeReason;
      blacklist.set(user.id, entry);
      saveBlacklist();

      pushActivity(interaction.user.id, "BLACKLIST_REVOKE", `Revoked blacklist on ${user.username}`, { targetId: user.id });

      await logBlacklist(
        interaction.guild,
        "✅ Blacklist Revoked",
        [
          { name: "User", value: `${user} (ID: ${user.id})`, inline: false },
          { name: "Revoke reason", value: revokeReason, inline: false },
          { name: "Revoked by", value: `${interaction.user}`, inline: false },
        ],
        0x2ecc71
      );
      return safeReply(interaction, `✅ Blacklist revoked for ${user}.`);
    }

    // ---------- VIEW ALL BLACKLIST ----------
    if (interaction.commandName === "viewallblacklist") {
      if (!isCaseStaff(interaction.member)) return safeReply(interaction, "❌ No permission.");
      await safeAck(interaction);

      const entries = Array.from(blacklist.values());
      if (!entries.length) return safeReply(interaction, "✅ Blacklist is empty.");

      const lines = entries.map((e) => {
        const status = e.revoked ? "REVOKED" : "ACTIVE";
        return `• ${status} | ${e.userTag || "Unknown"} (ID: ${e.userId}) | Case: ${e.caseId || "N/A"} | Reason: ${e.reason || "N/A"}`;
      });

      const fullText = `BLACKLIST (${entries.length})\n\n${lines.join("\n")}`;
      const chunks = chunkText(fullText);

      try {
        await interaction.user.send("📩 Here is the full blacklist:");
        for (const c of chunks) await interaction.user.send(c);
      } catch {
        return safeReply(interaction, "❌ I couldn’t DM you. Enable DMs and try again.");
      }
      return safeReply(interaction, "✅ Sent blacklist to your DMs.");
    }



// ===============================
// /bgc — Background Check Command
// ===============================
const BLACKLIST_SHEET_ID = "1aN6dita2rj3943Dk0KjC5kS5XVtnZ8Zg7XgBWq_qdJo";

async function fetchJson(url) {
  const res = await fetchFn(url).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

async function fetchText(url) {
  const res = await fetchFn(url).catch(() => null);
  if (!res || !res.ok) return null;
  return res.text();
}

function scoreRisk(flags) {
  let score = 0;
  if (flags.lowAge) score += 35;
  if (flags.lowFriends) score += 20;
  if (flags.lowBadges) score += 20;
  if (flags.privateInventory) score += 15;
  if (flags.usernameSuspicious) score += 20;
  if (flags.punishments.length) score += 60;
  if (flags.blacklisted) score += 100;
  return Math.min(score, 200);
}

function riskLevel(score) {
  if (score === 0) return "None";
  if (score <= 60) return "Low";
  if (score <= 100) return "Medium";
  return "High";
}

function suspiciousUsername(name) {
  return /(.)\1{5,}|\d{4,}/i.test(name);
}

async function getBlacklistRecords(username) {
  const csv = await fetchText(
    `https://docs.google.com/spreadsheets/d/${BLACKLIST_SHEET_ID}/gviz/tq?tqx=out:csv`
  );
  if (!csv) return [];
  const lines = csv.split("\n").slice(1);
  return lines
    .map(l => l.split(","))
    .filter(r => (r[1] || "").toLowerCase() === username.toLowerCase())
    .map(r => ({
      type: r[6],
      reason: r[7],
      status: r[5],
    }));
}

// 🔧 Wire this to YOUR punishment systems
function getAegisPunishments(username) {
  return []; // ← replace with your cases / casefiles / blacklist logic
}


    // =======================================================
// ✅ /applicationreview (staff reviews APP-xxxxx)
// =======================================================
if (interaction.commandName === "applicationreview") {
  if (!mustBeReviewer(interaction)) return;
  await safeAck(interaction, true);

  const applicationId = interaction.options.getString("application_id", true).trim().toUpperCase();
  const decision = interaction.options.getString("decision", true);
  const notes = interaction.options.getString("notes", true);

  const app = applications.get(applicationId);
  if (!app) return safeReply(interaction, `❌ Application not found: **${applicationId}**`, true);

  if (app.status && app.status !== "PENDING") {
    return safeReply(interaction, `❌ This application is already **${app.status}**.`, true);
  }

  app.status = decision === "ACCEPT" ? "ACCEPTED" : "DENIED";
  app.reviewedById = interaction.user.id;
  app.reviewedAt = new Date().toISOString();
  app.reviewNotes = notes.slice(0, 1500);

  applications.set(applicationId, app);
  saveApplications();

  // DM applicant
  const user = await client.users.fetch(app.userId).catch(() => null);
  if (user) {
    try {
      await user.send(
        `📩 **Application Update**\n` +
        `Application: **${applicationId}**\n` +
        `Department: **${app.dept}**\n` +
        `Decision: **${app.status}**\n` +
        `Notes: ${app.reviewNotes}\n` +
        `Reviewed by: ${interaction.user}`
      );
    } catch {}
  }

  // log to applications channel
  const ch = await getTextChannel(interaction.guild, APPLICATIONS_CHANNEL_ID);
  if (ch) {
    await ch.send({
      embeds: [
        {
          title: `✅ Application Reviewed (${applicationId})`,
          color: app.status === "ACCEPTED" ? 0x2ecc71 : 0xe74c3c,
          fields: [
            { name: "Applicant", value: `<@${app.userId}> (ID: ${app.userId})`, inline: false },
            { name: "Department", value: String(app.dept), inline: true },
            { name: "Decision", value: app.status, inline: true },
            { name: "Reviewed by", value: `${interaction.user}`, inline: false },
            { name: "Notes", value: app.reviewNotes || "None", inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  pushActivity(interaction.user.id, "APPLICATION_REVIEW", `${app.status} ${applicationId}`, {
    applicationId,
    decision: app.status,
  });

  return safeReply(interaction, `✅ Application **${applicationId}** marked **${app.status}**.`, true);
}

  } catch (err) {
    console.error("InteractionCreate error:", err);
    try {
      if (!interaction.isRepliable()) return;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ An error occurred.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
      }
    } catch {}
  }
});

if (!BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN in .env");
  process.exit(1);
}
client.login(BOT_TOKEN);











