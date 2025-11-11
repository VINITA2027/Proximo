/* script.js — clean frontend-only version */

// ---------- 1) State ----------
let currentUser = null;
let events = [];
let editingEventId = null;
const EVENT_TYPES = ["Hackathon", "Seminar", "Webinar", "Workshop"];

// ---------- 2) UI Helpers ----------
const el = (id) => document.getElementById(id);
const show = (el, bool = true) => el?.classList.toggle("hidden", !bool);
const flex = (el, bool = true) => {
  if (!el) return;
  el.classList.toggle("hidden", !bool);
  if (bool) el.classList.add("flex");
};

// ---------- 3) Elements ----------
const sectionAuth = el("sectionAuth");
const sectionStudent = el("sectionStudent");
const sectionOrganizer = el("sectionOrganizer");
const sectionHelp = el("sectionHelp");

const openAuthBtn = el("openAuthBtn");
const userMenuContainer = el("userMenuContainer");
const userRoleLabel = el("userRoleLabel");
const userNameLabel = el("userNameLabel");
const signOutBtn = el("signOutBtn");

const navButtons = [...document.querySelectorAll(".nav-btn")];
const authForm = el("authForm");
const modalOverlay = el("modalOverlay");
const modalTitle = el("modalTitle");
const modalBody = el("modalBody");
const modalClose = el("modalClose");
const modalOkay = el("modalOkay");
const modalConfirm = el("modalConfirm");

const eventsGrid = el("eventsGrid");
const eventsCount = el("eventsCount");
const filterBtn = el("filterBtn");
const filterMenu = el("filterMenu");
const filterTypeName = el("filterTypeName");
const filterLabel = el("filterLabel");
const noEventsBox = el("noEventsBox");

const chatContainer = el("chatContainer");
const chatInput = el("chatInput");
const chatSendBtn = el("chatSendBtn");

// ---------- 4) Navigation ----------
function setPage(name) {
  show(sectionAuth, name === "auth");
  show(sectionStudent, name === "student");
  show(sectionOrganizer, name === "organizer");
  show(sectionHelp, name === "help");
  navButtons.forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
}

// ---------- 5) Modals ----------
function openModal({ title = "Notice", html = "", confirm = null, confirmText = "Confirm" }) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  show(modalConfirm, !!confirm);
  modalConfirm.textContent = confirmText;
  modalConfirm.onclick = () => {
    if (confirm) confirm();
    closeModal();
  };
  flex(modalOverlay, true);
}
function closeModal() {
  flex(modalOverlay, false);
}
modalClose.onclick = closeModal;
modalOkay.onclick = closeModal;

// ---------- 6) Auth Redirect ----------
authForm.onsubmit = (e) => {
  e.preventDefault();

  // Mock login success
  currentUser = {
    type: isStudent ? "student" : "organizer",
    name: isStudent ? "Demo Student" : "Demo Organizer",
    email: "demo@eventhub.com",
  };

  openAuthBtn.classList.add("hidden");
  userMenuContainer.classList.remove("hidden");
  userRoleLabel.textContent = isStudent ? "Student" : "Organizer";
  userNameLabel.textContent = currentUser.name;

  setPage(isStudent ? "student" : "organizer");
  openModal({
    title: "Welcome",
    html: `<p>Welcome, <b>${currentUser.name}</b>! You are now logged in as a ${isStudent ? "student" : "organizer"}.</p>`,
  });
};

// ---------- 7) Navigation Buttons ----------
navButtons.forEach((b) => {
  b.onclick = () => {
    const key = b.dataset.nav;
    if (key === "home")
      setPage(currentUser ? (currentUser.type === "student" ? "student" : "organizer") : "auth");
    else if (key === "help") setPage("help");
  };
});

signOutBtn.onclick = () => {
  currentUser = null;
  userMenuContainer.classList.add("hidden");
  openAuthBtn.classList.remove("hidden");
  setPage("auth");
};

// ---------- 8) Events Demo ----------
const dummyEvents = [
  {
    id: 1,
    title: "National Hackathon 2025",
    type: "Hackathon",
    location: "IIT Delhi",
    date: "2025-12-15",
    timing: "9:00 AM - 5:00 PM",
    organization: "Tech Ministry",
    description: "A 24-hour national-level hackathon for students across India.",
    link: "https://example.com/register",
  },
  {
    id: 2,
    title: "AI & Robotics Workshop",
    type: "Workshop",
    location: "Online",
    date: "2025-11-25",
    timing: "10:00 AM - 2:00 PM",
    organization: "EventHub Learning",
    description: "An interactive online workshop on AI and robotics fundamentals.",
    link: "",
  },
];

events = dummyEvents;

function renderStudentEvents() {
  const filtered = selectedType === "All" ? events : events.filter((ev) => ev.type === selectedType);
  eventsCount.textContent = filtered.length;
  eventsGrid.innerHTML = filtered.map(eventCardHTML).join("");
  show(noEventsBox, filtered.length === 0);
}

function eventCardHTML(e) {
  const dateStr = e.date ? new Date(e.date).toDateString() : "";
  return `
    <div class="card">
      <div>
        <div class="flex justify-between items-start mb-3">
          <span class="badge">${e.type}</span>
          <h3 class="text-lg font-bold ml-4">${escapeHTML(e.title)}</h3>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${escapeHTML(e.description)}</p>
        <div class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p><b>Location:</b> ${escapeHTML(e.location)}</p>
          <p><b>Date:</b> ${dateStr}</p>
          <p><b>Time:</b> ${escapeHTML(e.timing)}</p>
          <p><b>Organizer:</b> ${escapeHTML(e.organization)}</p>
        </div>
      </div>
      ${e.link ? `<a href="${e.link}" target="_blank" class="btn-primary mt-4 w-full justify-center">View Details</a>` : ""}
    </div>
  `;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

// ---------- 9) Filters ----------
let selectedType = "All";
filterMenu.innerHTML = ["All", ...EVENT_TYPES]
  .map((t) => `<button data-filter="${t}" class="block w-full text-left px-3 py-2 hover:bg-indigo-100">${t}</button>`)
  .join("");

filterBtn.addEventListener("click", () => filterMenu.classList.toggle("hidden"));
filterMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  selectedType = btn.dataset.filter;
  filterTypeName.textContent = selectedType;
  filterLabel.textContent = selectedType;
  filterMenu.classList.add("hidden");
  renderStudentEvents();
});

// ---------- 10) Chatbot ----------
const chatbotResponses = {
  hello: "Hello! I'm your Event Finder Assistant. How can I help?",
  "how to use": "Use the top navigation to switch between Home and Help. Log in to view events.",
  events: "You can view hackathons, workshops, and seminars here!",
  default: "Sorry, I didn't understand. Try asking about events or usage.",
};

function pushChat(sender, text) {
  const wrap = document.createElement("div");
  wrap.className = `flex ${sender === "user" ? "justify-end" : "justify-start"}`;
  const bubble = document.createElement("div");
  bubble.className = `chat ${sender === "user" ? "user" : "bot"}`;
  text.split("\n").forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    bubble.appendChild(p);
  });
  wrap.appendChild(bubble);
  chatContainer.appendChild(wrap);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function botReply(input) {
  const clean = input.toLowerCase().trim();
  const key = Object.keys(chatbotResponses).find((k) => clean.includes(k)) || "default";
  setTimeout(() => pushChat("bot", chatbotResponses[key]), 400);
}

chatSendBtn.onclick = () => {
  const val = chatInput.value.trim();
  if (!val) return;
  pushChat("user", val);
  chatInput.value = "";
  botReply(val);
};
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") chatSendBtn.click();
});
pushChat("bot", chatbotResponses.hello);

// ---------- 10.5) Auth Form Toggle (Sign In / Sign Up) ----------
let isSignIn = true;
let isStudent = true;

const btnSignIn = el("btnSignIn");
const btnSignUp = el("btnSignUp");
const btnStudent = el("btnStudent");
const btnOrganizer = el("btnOrganizer");
const authHeader = el("authHeader");
const authSubheader = el("authSubheader");
const phoneReq = el("phoneReq");
const studentOnly = [...document.querySelectorAll(".student-only")];
const organizerOnly = [...document.querySelectorAll(".organizer-only")];

function updateAuthMode() {
  btnSignIn.classList.toggle("active", isSignIn);
  btnSignUp.classList.toggle("active", !isSignIn);
  btnStudent.classList.toggle("active", isStudent);
  btnOrganizer.classList.toggle("active", !isStudent);

  authHeader.textContent = isSignIn ? "Welcome Back" : "Join Proximo";
  authSubheader.textContent = `${isSignIn ? "Sign In" : "Sign Up"} as ${isStudent ? "Student" : "Organizer"}`;

  studentOnly.forEach(el => el.classList.toggle("hidden", !( !isSignIn && isStudent )));
  organizerOnly.forEach(el => el.classList.toggle("hidden", !( !isSignIn && !isStudent )));
  phoneReq.classList.toggle("hidden", isSignIn);
}

btnSignIn.onclick = () => { isSignIn = true; updateAuthMode(); };
btnSignUp.onclick = () => { isSignIn = false; updateAuthMode(); };
btnStudent.onclick = () => { isStudent = true; updateAuthMode(); };
btnOrganizer.onclick = () => { isStudent = false; updateAuthMode(); };

updateAuthMode();

// ---------- 11) Initialize ----------
setPage("auth");
renderStudentEvents();
