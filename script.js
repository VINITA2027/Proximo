/* script.js (type="module") */

// --------- 1) Firebase (CDN Modules) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot,
  query, where, getDocs, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------- 2) CONFIG: Put YOUR Firebase web config here ----------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
// Optional app id used in your original paths
const appId = "default-app-id"; // change if you want

// ---------- 3) Constants ----------
const EVENT_TYPES = ["Hackathon", "Seminar", "Webinar", "Workshop"];
const USERS_COLLECTION = "users";
const EVENTS_COLLECTION = "events";

const getPublicCollectionRef = (db, name) =>
  collection(db, "artifacts", appId, "public", "data", name);

const getUsersCollectionRef = (db) =>
  collection(db, "artifacts", appId, "users", "global", USERS_COLLECTION);

// ---------- 4) State ----------
let firebaseApp = null;
let db = null;
let auth = null;

let currentUser = null;   // Firestore user document (our app-level user)
let events = [];          // All events from Firestore (public)
let isAuthReady = false;
let dbReady = false;

let editingEventId = null;

// ---------- 5) UI elements ----------
const el = (id) => document.getElementById(id);

const sectionLoading   = el("sectionLoading");
const sectionAuth      = el("sectionAuth");
const sectionStudent   = el("sectionStudent");
const sectionOrganizer = el("sectionOrganizer");
const sectionHelp      = el("sectionHelp");

const openAuthBtn = el("openAuthBtn");
const userMenuContainer = el("userMenuContainer");
const userMenuBtn = el("userMenuBtn");
const userDropdown = el("userDropdown");
const userRoleLabel = el("userRoleLabel");
const userNameLabel = el("userNameLabel");
const signOutBtn = el("signOutBtn");
const brandHome = el("brandHome");

const navButtons = [...document.querySelectorAll(".nav-btn")];

const btnSignIn = el("btnSignIn");
const btnSignUp = el("btnSignUp");
const btnStudent = el("btnStudent");
const btnOrganizer = el("btnOrganizer");

const authHeader = el("authHeader");
const authSubheader = el("authSubheader");
const authError = el("authError");
const authForm = el("authForm");
const phoneReq = el("phoneReq");
const authSubmit = el("authSubmit");

const eventsGrid = el("eventsGrid");
const eventsCount = el("eventsCount");
const filterBtn = el("filterBtn");
const filterMenu = el("filterMenu");
const filterTypeName = el("filterTypeName");
const filterLabel = el("filterLabel");
const noEventsBox = el("noEventsBox");

const formTitle = el("formTitle");
const eventForm = el("eventForm");
const cancelEditBtn = el("cancelEditBtn");
const ev_title = el("ev_title");
const ev_type = el("ev_type");
const ev_location = el("ev_location");
const ev_date = el("ev_date");
const ev_timing = el("ev_timing");
const ev_org = el("ev_org");
const ev_link = el("ev_link");
const ev_desc = el("ev_desc");
const myEventsGrid = el("myEventsGrid");
const myCount = el("myCount");
const noMyEvents = el("noMyEvents");

const modalOverlay = el("modalOverlay");
const modalTitle = el("modalTitle");
const modalBody = el("modalBody");
const modalClose = el("modalClose");
const modalOkay = el("modalOkay");
const modalConfirm = el("modalConfirm");

// Chatbot
const chatContainer = el("chatContainer");
const chatInput = el("chatInput");
const chatSendBtn = el("chatSendBtn");

// ---------- 6) Helpers ----------
const show = (el, bool = true) => {
  if (!el) return;
  el.classList.toggle("hidden", !bool);
};
const flex = (el, bool = true) => {
  if (!el) return;
  el.classList.toggle("hidden", !bool);
  if (bool) el.classList.add("flex");
};

const setActiveNav = (key) => {
  navButtons.forEach((b) => {
    const active = b.dataset.nav === key;
    b.classList.toggle("active", active);
  });
};

const setPage = (name) => {
  show(sectionAuth, name === "auth");
  show(sectionStudent, name === "student");
  show(sectionOrganizer, name === "organizer");
  show(sectionHelp, name === "help");
  setActiveNav(name === "help" ? "help" : "home");
};

const openModal = ({ title = "Notice", html = "", confirm = null, confirmText = "Confirm" }) => {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  show(modalConfirm, !!confirm);
  modalConfirm.textContent = confirmText;

  modalConfirm.onclick = () => {
    if (confirm) confirm();
    closeModal();
  };
  flex(modalOverlay, true);
};
const closeModal = () => flex(modalOverlay, false);

// ---------- 7) App Init ----------
async function initApp() {
  try {
    show(sectionLoading, true);

    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);

    await signInAnonymously(auth).catch(() => {}); // fallback if needed

    onAuthStateChanged(auth, () => {
      isAuthReady = true;
      dbReady = !!db;
      show(sectionLoading, false);

      // Default to auth page
      setPage("auth");
    });

    // Fill event types select + filter menu
    ev_type.innerHTML = EVENT_TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
    filterMenu.innerHTML = ["All", ...EVENT_TYPES]
      .map(t => `<button data-filter="${t}">${t}</button>`).join("");

    // Real-time events listener
    const eventsRef = getPublicCollectionRef(db, EVENTS_COLLECTION);
    onSnapshot(eventsRef, (snap) => {
      events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStudentEvents();
      renderMyEvents();
    });

    // If user previously selected role & user object (optional from same session)
    // (We don't persist session here; Firestore is source of truth after sign in/up)
  } catch (e) {
    console.error("Init error:", e);
    openModal({ title: "Error", html: `<p>Failed to initialize Firebase. Check your config in <b>script.js</b>.</p>` });
  }
}

// ---------- 8) Auth UI Logic ----------
let isSignIn = true;
let isStudent = true;

const studentOnly = [...document.querySelectorAll(".student-only")];
const organizerOnly = [...document.querySelectorAll(".organizer-only")];

function updateAuthMode() {
  btnSignIn.classList.toggle("active", isSignIn);
  btnSignUp.classList.toggle("active", !isSignIn);

  btnStudent.classList.toggle("active", isStudent);
  btnOrganizer.classList.toggle("active", !isStudent);

  authHeader.textContent = isSignIn ? "Welcome Back" : "Join EventHub Pro";
  authSubheader.textContent = `${isSignIn ? "Sign In" : "Sign Up"} as ${isStudent ? "Student" : "Organizer"}`;

  studentOnly.forEach(el => el.classList.toggle("hidden", !( !isSignIn && isStudent )));
  organizerOnly.forEach(el => el.classList.toggle("hidden", !( !isSignIn && !isStudent )));

  phoneReq.classList.toggle("hidden", isSignIn);
  authError.classList.add("hidden");
}

btnSignIn.onclick = () => { isSignIn = true; updateAuthMode(); };
btnSignUp.onclick = () => { isSignIn = false; updateAuthMode(); };
btnStudent.onclick = () => { isStudent = true; updateAuthMode(); };
btnOrganizer.onclick = () => { isStudent = false; updateAuthMode(); };
openAuthBtn.onclick = () => setPage("auth");
brandHome.onclick = () => setPage(currentUser ? (currentUser.type === "student" ? "student" : "organizer") : "auth");

// Sign In / Sign Up handler (Firestore user records, like your React logic)
authForm.onsubmit = async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const email = el("email").value.trim().toLowerCase();
  const password = el("password").value.trim();
  const phone = el("phone").value.trim();

  const usersRef = getUsersCollectionRef(db);

  try {
    if (isSignIn) {
      // Login by checking Firestore for matching credentials and role
      const q = query(usersRef,
        where("email", "==", email),
        where("password", "==", password),
        where("type", "==", isStudent ? "student" : "organizer")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        currentUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
        afterLogin();
      } else {
        authError.textContent = "Invalid credentials or user type.";
        authError.classList.remove("hidden");
      }
    } else {
      // Sign Up path — validate required fields
      const required = isStudent
        ? ["name", "age", "gender", "email", "password", "phone"]
        : ["organization", "email", "password", "phone"];

      const missing = required.filter(f => {
        if (f === "name") return !el("name").value.trim();
        if (f === "age") return !el("age").value.trim();
        if (f === "gender") return !el("gender").value.trim();
        if (f === "organization") return !el("organization").value.trim();
        if (f === "email") return !email;
        if (f === "password") return !password;
        if (f === "phone") return !phone;
        return false;
      });

      if (missing.length) {
        authError.textContent = "Please fill in all required fields.";
        authError.classList.remove("hidden");
        return;
      }

      // Check existing email
      const emailCheck = query(usersRef, where("email", "==", email));
      const emailSnap = await getDocs(emailCheck);
      if (!emailSnap.empty) {
        authError.textContent = "An account with this email already exists.";
        authError.classList.remove("hidden");
        return;
      }

      const newUser = {
        type: isStudent ? "student" : "organizer",
        email, password, phone,
        createdAt: new Date().toISOString(),
      };
      if (isStudent) {
        newUser.name = el("name").value.trim();
        newUser.age = el("age").value.trim();
        newUser.gender = el("gender").value.trim();
        newUser.college = el("college").value.trim();
      } else {
        newUser.organization = el("organization").value.trim();
      }

      const docRef = await addDoc(usersRef, newUser);
      currentUser = { id: docRef.id, ...newUser };
      openModal({ title: "Success", html: `<p>Account created successfully! Welcome, <b>${currentUser.name || currentUser.organization || "User"}</b>.</p>` });
      afterLogin();
    }
  } catch (err) {
    console.error("Auth Error:", err);
    authError.textContent = "An unexpected error occurred during authentication.";
    authError.classList.remove("hidden");
  }
};

function afterLogin() {
  // header user menu
  openAuthBtn.classList.add("hidden");
  userMenuContainer.classList.remove("hidden");
  userRoleLabel.textContent = currentUser.type === "student" ? "Student" : "Organizer";
  userNameLabel.textContent = currentUser.name || currentUser.organization || currentUser.email;

  // Go to dashboard
  setPage(currentUser.type === "student" ? "student" : "organizer");
  renderStudentEvents();
  renderMyEvents();
}

// Dropdown menu show/hide
userMenuBtn?.addEventListener("click", () => {
  userDropdown.classList.toggle("show");
});
document.addEventListener("click", (e) => {
  if (!userMenuContainer.contains(e.target)) {
    userDropdown.classList.remove("show");
  }
});

// Sign out (just clear app-level user, keep anonymous auth session)
signOutBtn.onclick = () => {
  currentUser = null;
  userMenuContainer.classList.add("hidden");
  openAuthBtn.classList.remove("hidden");
  setPage("auth");
};

// Nav buttons
navButtons.forEach((b) => {
  b.onclick = () => {
    const key = b.dataset.nav;
    if (key === "home") {
      setPage(currentUser ? (currentUser.type === "student" ? "student" : "organizer") : "auth");
    } else if (key === "help") {
      setPage("help");
    }
  };
});

// ---------- 9) Student: events + filter ----------
let selectedType = "All";
const EVENT_TYPE_OPTIONS = ["All", ...EVENT_TYPES];

// Build filter menu
filterMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  selectedType = btn.dataset.filter;
  filterTypeName.textContent = selectedType;
  filterLabel.textContent = selectedType;
  filterMenu.classList.add("hidden");
  renderStudentEvents();
});
filterBtn.addEventListener("click", () => {
  filterMenu.classList.toggle("hidden");
});

// Render student events
function renderStudentEvents() {
  const filtered = selectedType === "All" ? events : events.filter(ev => ev.type === selectedType);
  eventsCount.textContent = filtered.length.toString();
  eventsGrid.innerHTML = filtered.map(eventCardHTML).join("");

  show(noEventsBox, filtered.length === 0);

  // bind buttons (none for student)
}

// ---------- 10) Organizer: post/edit/delete ----------
function clearEventForm() {
  editingEventId = null;
  formTitle.innerHTML = `<i data-lucide="plus" class="w-6 h-6 mr-2 text-green-500"></i> Post New Event`;
  el("saveEventBtn").innerHTML = `<i data-lucide="plus" class="w-5 h-5 mr-2"></i> Post Event`;
  cancelEditBtn.classList.add("hidden");

  ev_title.value = "";
  ev_type.value = EVENT_TYPES[0];
  ev_location.value = "";
  ev_date.value = "";
  ev_timing.value = "";
  ev_org.value = currentUser?.organization || currentUser?.email || "";
  ev_link.value = "";
  ev_desc.value = "";

  lucide.createIcons();
}
cancelEditBtn.onclick = () => clearEventForm();

eventForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser || currentUser.type !== "organizer") {
    openModal({ title: "Attention", html: "<p>You must be an Organizer to post events.</p>" });
    return;
  }

  const title = ev_title.value.trim();
  const type = ev_type.value;
  const location = ev_location.value.trim();
  const date = ev_date.value;
  const timing = ev_timing.value.trim();
  const organization = ev_org.value.trim();
  const link = ev_link.value.trim();
  const description = ev_desc.value.trim();

  if (!title || !type || !location || !date || !timing || !organization || !description) {
    openModal({ title: "Attention", html: "<p>Please fill in all required event details.</p>" });
    return;
  }

  try {
    const eventsRef = getPublicCollectionRef(db, EVENTS_COLLECTION);
    const payload = {
      title, type, location, date, timing, organization, link, description,
      organizerId: currentUser.email,
      updatedAt: new Date().toISOString(),
      ts: serverTimestamp()
    };

    if (editingEventId) {
      // update
      await setDoc(doc(eventsRef, editingEventId), payload, { merge: true });
      openModal({ title: "Success", html: "<p>Event updated successfully!</p>" });
    } else {
      // create
      await addDoc(eventsRef, { ...payload, createdAt: new Date().toISOString() });
      openModal({ title: "Success", html: "<p>New event posted successfully!</p>" });
    }
    clearEventForm();
  } catch (err) {
    console.error("Save event error:", err);
    openModal({ title: "Error", html: "<p>Failed to save event. Check console for details.</p>" });
  }
};

function renderMyEvents() {
  if (!currentUser || currentUser.type !== "organizer") return;
  const mine = events.filter(e => e.organizerId === currentUser.email);
  myCount.textContent = mine.length.toString();

  myEventsGrid.innerHTML = mine.map(e => eventCardHTML(e, true)).join("");
  show(noMyEvents, mine.length === 0);

  // Bind edit/delete
  mine.forEach((ev) => {
    const editBtn = document.querySelector(`[data-edit="${ev.id}"]`);
    const delBtn = document.querySelector(`[data-del="${ev.id}"]`);
    editBtn?.addEventListener("click", () => startEdit(ev.id));
    delBtn?.addEventListener("click", () => confirmDelete(ev.id));
  });

  lucide.createIcons();
}

function startEdit(id) {
  const ev = events.find(x => x.id === id);
  if (!ev) return;

  editingEventId = id;
  formTitle.innerHTML = `<i data-lucide="edit" class="w-6 h-6 mr-2 text-indigo-500"></i> Editing Event: ${ev.title}`;
  el("saveEventBtn").innerHTML = `<i data-lucide="save" class="w-5 h-5 mr-2"></i> Save Changes`;
  cancelEditBtn.classList.remove("hidden");

  ev_title.value = ev.title || "";
  ev_type.value = ev.type || EVENT_TYPES[0];
  ev_location.value = ev.location || "";
  ev_date.value = ev.date || "";
  ev_timing.value = ev.timing || "";
  ev_org.value = ev.organization || (currentUser?.organization || currentUser?.email || "");
  ev_link.value = ev.link || "";
  ev_desc.value = ev.description || "";

  lucide.createIcons();
}

function confirmDelete(id) {
  openModal({
    title: "Confirm Deletion",
    html: "<p>Are you sure you want to delete this event? This cannot be undone.</p>",
    confirm: async () => {
      try {
        const eventsRef = getPublicCollectionRef(db, EVENTS_COLLECTION);
        await deleteDoc(doc(eventsRef, id));
        openModal({ title: "Success", html: "<p>Event deleted successfully.</p>" });
      } catch (err) {
        console.error("Delete error:", err);
        openModal({ title: "Error", html: "<p>Failed to delete event. Check console for details.</p>" });
      }
    },
    confirmText: "Delete"
  });
}

// ---------- 11) Chatbot ----------
const chatbotResponses = {
  "hello": "Hello! I'm your Event Finder Assistant. How can I guide you through the website today?",
  "how to create event": "Organizers must first sign up or sign in as an 'Organizer'. Then use the form on your dashboard to post a new event—add type, location, and date. It saves in Firestore!",
  "how to see events": "Students sign in as 'Student'. The dashboard loads all events in real-time from Firestore. Use 'Filter by Type' to narrow down.",
  "what are the account types": "Two types: Student (discover events) and Organizer (post/manage events).",
  "how to delete an event": "Organizer → Your Posted Events → click Delete on the desired card and confirm.",
  "website flow chart": "Flow: Start → Auth (Student/Organizer) → Student Dashboard (browse/filter) OR Organizer Dashboard (post/manage) → Help.",
  "default": "Sorry, I didn't understand. Try asking about 'how to see events', 'how to create event', or 'what are the account types'."
};

function pushChat(sender, text) {
  const wrap = document.createElement("div");
  wrap.className = `flex ${sender === "user" ? "justify-end" : "justify-start"}`;
  const bubble = document.createElement("div");
  bubble.className = `chat ${sender === "user" ? "user" : "bot"}`;
  text.split("\n").forEach(line => {
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
  let key = "default";
  for (const k in chatbotResponses) {
    if (clean.includes(k)) { key = k; break; }
  }
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
// greet
pushChat("bot", chatbotResponses.hello);

// ---------- 12) Event card rendering ----------
function eventCardHTML(e, isOrganizer = false) {
  const dateStr = e.date ? new Date(e.date).toDateString() : "";
  return `
  <div class="card">
    <div>
      <div class="flex justify-between items-start mb-3">
        <span class="badge">${e.type || ""}</span>
        <h3 class="text-lg font-bold ml-4">${escapeHTML(e.title || "")}</h3>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${escapeHTML(e.description || "")}</p>
      <div class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <div class="flex items-center"><i data-lucide="building-2" class="w-4 h-4 mr-2 text-indigo-500"></i><span class="font-medium">${escapeHTML(e.organization || "N/A")}</span></div>
        <div class="flex items-center"><i data-lucide="map-pin" class="w-4 h-4 mr-2 text-indigo-500"></i><span>${escapeHTML(e.location || "")}</span></div>
        <div class="flex items-center"><i data-lucide="calendar" class="w-4 h-4 mr-2 text-indigo-500"></i><span>${dateStr}</span></div>
        <div class="flex items-center"><i data-lucide="clock" class="w-4 h-4 mr-2 text-indigo-500"></i><span>${escapeHTML(e.timing || "")}</span></div>
      </div>
    </div>
    <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      ${e.link ? `<a href="${escapeAttr(e.link)}" target="_blank" rel="noopener noreferrer" class="block w-full text-center py-2 px-4 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition duration-200 mb-2">View Event Link</a>` : ""}
      ${isOrganizer ? `
        <div class="flex space-x-2 mt-2">
          <button data-edit="${e.id}" class="flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-100 transition duration-200">
            <i data-lucide="edit-3" class="w-4 h-4 mr-1"></i> Edit
          </button>
          <button data-del="${e.id}" class="flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 transition duration-200">
            <i data-lucide="trash-2" class="w-4 h-4 mr-1"></i> Delete
          </button>
        </div>` : ``}
    </div>
  </div>`;
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]))}
function escapeAttr(s){return String(s).replace(/"/g,"&quot;")}

// ---------- 13) Modal events ----------
modalClose.onclick = closeModal;
modalOkay.onclick = closeModal;

// ---------- 14) Default UI setup ----------
updateAuthMode();
setPage("auth");
initApp();
