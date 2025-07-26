// Simple Private Messaging Demo with Firebase

// --- CONFIG ---
// Replace with your own Firebase config!
const firebaseConfig = {
  apiKey: "AIzaSyAcKNUaCd3Xo-GUxBA_NmzVWfVpnVC-m0A",
  authDomain: "syndicate-ragestar.firebaseapp.com",
  databaseURL: "https://syndicate-ragestar-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "syndicate-ragestar",
  storageBucket: "syndicate-ragestar.firebaseapp.com",
  messagingSenderId: "999935359149",
  appId: "1:999935359149:web:190243de7b87b8b429ae24",
  measurementId: "G-728FW0TF79"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- UTIL ---
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[m]);
}
function getConversationKey(userA, userB) {
  return [userA, userB].sort().join("__");
}

// --- UI Elements ---
const usernameInput = document.getElementById("pm-username");
const userSelect = document.getElementById("pm-user-select");
const chatWindow = document.getElementById("pm-chat-window");
const msgForm = document.getElementById("pm-new-msg-form");
const msgText = document.getElementById("pm-new-msg-text");

// --- State ---
let myUsername = "";
let allUsers = [];
let currentRecipient = "";

// --- Fetch All Users ---
async function fetchAllUsers() {
  // Get all unique usernames from /messages and fallback to hardcoded for demo
  const snap = await db.ref("messages").once("value");
  const val = snap.val() || {};
  const userSet = new Set();
  Object.values(val).forEach(conv => {
    Object.values(conv).forEach(msg => {
      if (msg.from) userSet.add(msg.from);
      if (msg.to) userSet.add(msg.to);
    });
  });
  allUsers = Array.from(userSet);
  if (!allUsers.length) {
    // Demo fallback
    allUsers = ['Alice', 'Bob', 'Charlie', 'David'];
  }
  updateUserSelect();
}

// --- Update User Select List ---
function updateUserSelect() {
  const myName = usernameInput.value.trim();
  userSelect.innerHTML = allUsers
    .filter(u => u !== myName)
    .map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`)
    .join("");
  // Pick first recipient if none
  if (!userSelect.value && userSelect.options.length) {
    userSelect.value = userSelect.options[0].value;
  }
  currentRecipient = userSelect.value || "";
  loadMessages();
}

// --- Load Messages ---
function loadMessages() {
  chatWindow.innerHTML = `<div style="color:#7bffe9;padding:1em;text-align:center;">Loading...</div>`;
  if (!myUsername || !currentRecipient) return;
  const convKey = getConversationKey(myUsername, currentRecipient);
  db.ref('messages/' + convKey).off();
  db.ref('messages/' + convKey).on('value', snap => {
    const val = snap.val();
    let msgs = [];
    if(val) {
      for(const k in val) msgs.push(val[k]);
      msgs.sort((a,b) => new Date(a.time) - new Date(b.time));
    }
    chatWindow.innerHTML = msgs.length
      ? msgs.map(m => renderMessageBubble(m)).join("")
      : `<div style="color:#7bffe9;padding:1em;text-align:center;">No messages yet.</div>`;
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

// --- Render Message Bubble ---
function renderMessageBubble(m) {
  const isMe = m.from === myUsername;
  return `
    <div class="pm-message-row ${isMe ? 'self' : 'other'}">
      <div class="pm-msg-bubble">${escapeHtml(m.text)}
        <div class="pm-msg-meta">${isMe ? "You" : escapeHtml(m.from)} &mdash; <span>${escapeHtml(m.time)}</span></div>
      </div>
    </div>
  `;
}

// --- Send Message ---
msgForm.onsubmit = async function(e) {
  e.preventDefault();
  const text = msgText.value.trim();
  if(!text || !myUsername || !currentRecipient) return;
  const now = new Date();
  const msg = {
    from: myUsername,
    to: currentRecipient,
    text,
    time: now.toLocaleString()
  };
  const convKey = getConversationKey(myUsername, currentRecipient);
  const newMsgRef = db.ref('messages/' + convKey).push();
  await newMsgRef.set(msg);
  msgText.value = "";
  loadMessages();
  fetchAllUsers(); // In case new user sent
};

// --- Username Change ---
usernameInput.oninput = function() {
  myUsername = usernameInput.value.trim();
  updateUserSelect();
};

// --- Chat Partner Change ---
userSelect.onchange = function() {
  currentRecipient = userSelect.value;
  loadMessages();
};

// --- Init ---
window.onload = async function() {
  await fetchAllUsers();
  myUsername = usernameInput.value.trim();
  updateUserSelect();
};
