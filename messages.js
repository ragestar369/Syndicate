// WhatsApp-style Private Messaging (one-to-one, two column)

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[m]);
}
function getMemberSession() {
  return sessionStorage.getItem("member_username");
}
function clearMemberSession() {
  sessionStorage.removeItem("member_username");
}

// Get all members except self
async function getMemberList() {
  const snap = await db.ref('members').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}

// Conversation key (sorted usernames)
function getConversationKey(userA, userB) {
  return [userA, userB].sort().join("___");
}

// --- UI State ---
let myUsername = null;
let allMembers = [];
let chatUsers = [];  // Users with whom there are messages
let currentRecipient = null;
let messageListener = null;

// --- DOM Elements ---
const chatListElem = () => document.getElementById("pm-user-select");
const searchElem = () => document.getElementById("search-user");
const messagesElem = () => document.getElementById("pm-chat-window");

// --- Loader ---
function showLoader(show) {
  document.getElementById('loader-overlay').style.display = show ? "flex" : "none";
}

// --- Render Chat List ---
function renderChatList() {
  const search = (searchElem().value || "").toLowerCase();
  const filtered = allMembers.filter(
    m => m.username !== myUsername && (!search || m.username.toLowerCase().includes(search))
  );
  // Show users with whom we have chat history at top
  const sorted = [
    ...filtered.filter(m => chatUsers.includes(m.username)),
    ...filtered.filter(m => !chatUsers.includes(m.username))
  ];

  chatListElem().innerHTML = sorted.length
    ? sorted.map(m =>
        `<option value="${escapeHtml(m.username)}">${escapeHtml(m.username)}</option>`
      ).join("")
    : `<option disabled>No users</option>`;

  // If currentRecipient is not in filtered, reset to first
  if (!sorted.find(m => m.username === currentRecipient)) {
    currentRecipient = sorted.length ? sorted[0].username : null;
  }
  chatListElem().value = currentRecipient || "";

  // If there is a recipient, open chat with them
  if (currentRecipient) openChat(currentRecipient);
}

// --- Open Chat ---
function openChat(username) {
  if(messageListener) {
    messageListener.off();
    messageListener = null;
  }
  currentRecipient = username;
  messagesElem().innerHTML = `<div style="color:#7bffe9;padding:1em;text-align:center;">Loading...</div>`;

  // Listen for messages
  const convKey = getConversationKey(myUsername, currentRecipient);
  messageListener = db.ref('messages/' + convKey);
  messageListener.on('value', snap => {
    const val = snap.val();
    let msgs = [];
    if(val) {
      for(const k in val) msgs.push(val[k]);
      msgs.sort((a,b) => new Date(a.time) - new Date(b.time));
    }
    messagesElem().innerHTML = msgs.length
      ? msgs.map(m => renderMessageBubble(m)).join("")
      : `<div style="color:#7bffe9;padding:1em;text-align:center;">No messages yet.</div>`;
    messagesElem().scrollTop = messagesElem().scrollHeight;
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

// --- Refresh chatUsers list ---
async function updateChatUsers() {
  // Get all conversations under /messages
  const snap = await db.ref('messages').once('value');
  const val = snap.val() || {};
  chatUsers = [];
  Object.keys(val).forEach(k => {
    const users = k.split("___");
    if(users.includes(myUsername)) {
      const other = users[0] === myUsername ? users[1] : users[0];
      if(!chatUsers.includes(other)) chatUsers.push(other);
    }
  });
}

// --- MAIN ---
document.addEventListener("DOMContentLoaded", async function() {
  showLoader(true);
  myUsername = getMemberSession();
  if(!myUsername) {
    window.location.href = "index.html";
    return;
  }

  // Use correct ID for logout button
  document.getElementById("pm-logout-btn").onclick = function() {
    clearMemberSession();
    window.location.href = "index.html";
  };

  // Back button
  document.getElementById("pm-back-btn").onclick = function() {
    window.location.href = "index.html";
  };

  allMembers = await getMemberList();
  await updateChatUsers();
  renderChatList();
  showLoader(false);

  // Search users
  searchElem().oninput = renderChatList;

  // Change conversation partner
  chatListElem().onchange = function() {
    openChat(chatListElem().value);
  };

  // Send message
  document.getElementById("pm-new-msg-form").onsubmit = async function(e) {
    e.preventDefault();
    const text = document.getElementById("pm-new-msg-text").value.trim();
    if(!text || !currentRecipient) return;
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
    document.getElementById("pm-new-msg-text").value = "";
    await updateChatUsers();
    renderChatList();
  };
});
