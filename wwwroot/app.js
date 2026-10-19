
"use strict";

/*
 * Update these URLs if your Controllers or Hub use different routes.
 */
const API = {
    login: "/api/users/login",
    register: "/api/users/register",
    groups: "/api/groups",
    hub: "/chat"
};

const authScreen = document.getElementById("authScreen");
const chatScreen = document.getElementById("chatScreen");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authStatus = document.getElementById("authStatus");

const currentUsername = document.getElementById("currentUsername");
const userAvatar = document.getElementById("userAvatar");
const connectionStatus = document.getElementById("connectionStatus");

const groupsList = document.getElementById("groupsList");
const groupsStatus = document.getElementById("groupsStatus");
const newGroupBtn = document.getElementById("newGroupBtn");
const newGroupForm = document.getElementById("newGroupForm");
const newGroupName = document.getElementById("newGroupName");

const roomTitle = document.getElementById("roomTitle");
const roomSubtitle = document.getElementById("roomSubtitle");
const roomAvatar = document.getElementById("roomAvatar");
const messages = document.getElementById("messages");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatNotice = document.getElementById("chatNotice");
const logoutBtn = document.getElementById("logoutBtn");

let connection = null;
let currentRoom = null;
let currentUser = "";
let joiningRoom = false;

/* --------------------------
   Small helper functions
-------------------------- */

function getToken() {
    return localStorage.getItem("accessToken");
}

function setAuthStatus(message, isError = true) {
    authStatus.textContent = message;
    authStatus.style.color = isError ? "#d94b5b" : "#20a779";
}

function setChatNotice(message, isError = true) {
    chatNotice.textContent = message;
    chatNotice.style.color = isError ? "#d94b5b" : "#20a779";
}

function getErrorMessage(error, fallback = "Something went wrong.") {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    return error?.message || fallback;
}

async function readResponse(response) {
    const text = await response.text();

    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const message =
            data.message ||
            data.title ||
            data.detail ||
            `Request failed (${response.status}).`;

        throw new Error(message);
    }

    return data;
}

async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    return readResponse(response);
}

function getTokenFromResponse(data) {
    // Supports common token property names.
    return data.accessToken ||
        data.AccessToken ||
        data.token ||
        data.Token ||
        data.jwt ||
        data.Jwt ||
        null;
}

function showAuth() {
    authScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");
}

function showChat() {
    authScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
}

function setConnectionStatus(text, state = "") {
    connectionStatus.textContent = text;
    connectionStatus.classList.remove("online", "offline");

    if (state) {
        connectionStatus.classList.add(state);
    }
}

function displayUsername(name) {
    currentUser = name;
    currentUsername.textContent = name || "User";
    userAvatar.textContent = (name || "U").charAt(0).toUpperCase();
}

function formatTime(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* --------------------------
   Login / Sign Up tabs
-------------------------- */

function showLoginForm() {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    setAuthStatus("");
}

function showRegisterForm() {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    setAuthStatus("");
}

loginTab.addEventListener("click", showLoginForm);
registerTab.addEventListener("click", showRegisterForm);

/* --------------------------
   Registration
-------------------------- */

registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const password = document.getElementById("registerPassword").value;

    if (!name || !password) {
        setAuthStatus("Enter your username and password.");
        return;
    }

    const button = registerForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Creating account...";

    try {
        await apiRequest(API.register, {
            method: "POST",
            body: JSON.stringify({
                Name: name,
                Password: password
            })
        });

        document.getElementById("loginName").value = name;
        document.getElementById("loginPassword").value = "";
        showLoginForm();

        setAuthStatus("Account created. Please log in.", false);
    } catch (error) {
        setAuthStatus(getErrorMessage(error, "Registration failed."));
    } finally {
        button.disabled = false;
        button.textContent = "Create Account";
    }
});

/* --------------------------
   Login
-------------------------- */

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("loginName").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!name || !password) {
        setAuthStatus("Enter your username and password.");
        return;
    }

    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Logging in...";

    try {
        const data = await apiRequest(API.login, {
            method: "POST",
            body: JSON.stringify({
                Name: name,
                Password: password
            })
        });

        const token = getTokenFromResponse(data);

        if (!token) {
            throw new Error(
                "Login succeeded, but the API response did not contain a JWT token."
            );
        }

        localStorage.setItem("accessToken", token);
        localStorage.setItem("chatUsername", name);

        displayUsername(name);
        showChat();

        await startConnection();
        await loadGroups();

    } catch (error) {
        setAuthStatus(getErrorMessage(error, "Login failed."));

        if (connection) {
            await stopConnection();
        }

        showAuth();
    } finally {
        button.disabled = false;
        button.textContent = "Login";
    }
});

/* --------------------------
   SignalR connection
-------------------------- */

async function startConnection() {
    if (!window.signalR) {
        throw new Error("SignalR JavaScript library could not be loaded.");
    }

    if (connection &&
        connection.state !== signalR.HubConnectionState.Disconnected) {
        return;
    }

    connection = new signalR.HubConnectionBuilder()
        .withUrl(API.hub, {
            accessTokenFactory: () => getToken() || ""
        })
        .withAutomaticReconnect()
        .build();

    // This handler assumes the Hub sends:
    // Clients.Group(room).SendAsync("ReceiveMessage", sender, message)
    connection.on("ReceiveMessage", (sender, message, roomName, sentAt) => {
        // Ignore messages for other rooms if the Hub includes a room name.
        if (roomName && currentRoom &&
            roomName.toLowerCase() !== currentRoom.toLowerCase()) {
            return;
        }

        addMessage({
            sender: sender,
            message: message,
            sentAt: sentAt
        });
    });

    connection.onreconnecting(() => {
        setConnectionStatus("Reconnecting...", "offline");
        setChatNotice("Connection lost. Trying to reconnect...");
    });

    connection.onreconnected(async () => {
        setConnectionStatus("Connected", "online");
        setChatNotice("");

        // Rejoin the selected room after reconnection.
        if (currentRoom) {
            try {
                await connection.invoke("JoinRoom", currentRoom);
            } catch (error) {
                setChatNotice(getErrorMessage(error, "Could not rejoin the room."));
            }
        }
    });

    connection.onclose(() => {
        setConnectionStatus("Disconnected", "offline");
    });

    await connection.start();

    setConnectionStatus("Connected", "online");
    setChatNotice("");
}

async function stopConnection() {
    if (connection) {
        try {
            await connection.stop();
        } catch (error) {
            console.error("SignalR stop failed:", error);
        }

        connection = null;
    }

    currentRoom = null;
    setConnectionStatus("Disconnected", "offline");
}

/* --------------------------
   Load conversations
-------------------------- */

async function loadGroups() {
    groupsList.replaceChildren();
    groupsStatus.textContent = "Loading conversations...";

    try {
        const data = await apiRequest(API.groups);

        // Supports either ["general", "friends"] or { groups: [...] }.
        const rawGroups = Array.isArray(data)
            ? data
            : (data.groups || data.Groups || data.items || data.Items || []);

        const names = rawGroups
            .map(item => typeof item === "string"
                ? item
                : (item.nameGroup || item.NameGroup ||
                   item.name || item.Name))
            .filter(name => typeof name === "string" && name.trim())
            .map(name => name.trim());

        const uniqueNames = [...new Set(names)];

        groupsStatus.textContent = uniqueNames.length
            ? ""
            : "No conversations yet. Create one to get started.";

        uniqueNames.forEach(name => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "group-item";
            button.dataset.room = name;

            const icon = document.createElement("span");
            icon.className = "group-icon";
            icon.textContent = "#";

            const label = document.createElement("span");
            label.className = "group-name";
            label.textContent = name;

            button.append(icon, label);
            button.addEventListener("click", () => selectRoom(name));
            groupsList.append(button);
        });

        if (currentRoom && uniqueNames.includes(currentRoom)) {
            markActiveRoom(currentRoom);
        } else if (currentRoom) {
            currentRoom = null;
            showEmptyConversation();
        }
    } catch (error) {
        groupsStatus.textContent =
            "Could not load conversations: " +
            getErrorMessage(error);

        console.error("Load groups failed:", error);
    }
}

function markActiveRoom(roomName) {
    document.querySelectorAll(".group-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.room === roomName
        );
    });
}

/* --------------------------
   Create a conversation
-------------------------- */

newGroupBtn.addEventListener("click", () => {
    newGroupForm.classList.toggle("hidden");

    if (!newGroupForm.classList.contains("hidden")) {
        newGroupName.focus();
    }
});

newGroupForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = newGroupName.value.trim();

    if (!name) {
        return;
    }

    try {
        // Assumes POST /api/groups accepts { groupName: "general" }.
        await apiRequest(API.groups, {
            method: "POST",
            body: JSON.stringify({
                groupName: name
            })
        });

        newGroupName.value = "";
        newGroupForm.classList.add("hidden");

        await loadGroups();
        await selectRoom(name);
    } catch (error) {
        groupsStatus.textContent =
            "Could not create conversation: " +
            getErrorMessage(error);

        console.error("Create group failed:", error);
    }
});

/* --------------------------
   Select / join a room
-------------------------- */

async function selectRoom(roomName) {
    if (!connection ||
        connection.state !== signalR.HubConnectionState.Connected) {
        setChatNotice("Wait for the chat connection to be ready.");
        return;
    }

    if (joiningRoom) {
        return;
    }

    joiningRoom = true;

    try {
        if (currentRoom && currentRoom !== roomName) {
            await connection.invoke("LeaveRoom", currentRoom);
        }

        // Assumes the Hub exposes JoinRoom(string roomName).
        await connection.invoke("JoinRoom", roomName);

        currentRoom = roomName;
        roomTitle.textContent = roomName;
        roomSubtitle.textContent = "Conversation";
        roomAvatar.textContent = "#";

        messages.replaceChildren();
        messages.classList.remove("hidden");
        emptyState.classList.add("hidden");
        chatForm.classList.remove("hidden");

        markActiveRoom(roomName);
        setChatNotice("");
        messageInput.focus();
    } catch (error) {
        setChatNotice(
            "Could not join this conversation: " +
            getErrorMessage(error)
        );
        console.error("Join room failed:", error);
    } finally {
        joiningRoom = false;
    }
}

function showEmptyConversation() {
    roomTitle.textContent = "Choose a conversation";
    roomSubtitle.textContent = "Select a conversation to start chatting";
    roomAvatar.textContent = "#";

    messages.replaceChildren();
    messages.classList.add("hidden");
    emptyState.classList.remove("hidden");
    chatForm.classList.add("hidden");

    markActiveRoom("");
}

/* --------------------------
   Send a message
-------------------------- */

chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    const message = messageInput.value.trim();

    if (!message || !currentRoom) {
        return;
    }

    if (!connection ||
        connection.state !== signalR.HubConnectionState.Connected) {
        setChatNotice("You are disconnected. Please wait for reconnection.");
        return;
    }

    sendBtn.disabled = true;

    try {
        // Assumes the Hub exposes SendMessage(string roomName, string message).
        await connection.invoke("SendMessage", currentRoom, message);
        messageInput.value = "";
        setChatNotice("");
        messageInput.focus();
    } catch (error) {
        setChatNotice(getErrorMessage(error, "Message could not be sent."));
        console.error("Send message failed:", error);
    } finally {
        sendBtn.disabled = false;
    }
});

/* --------------------------
   Render incoming messages
-------------------------- */

function addMessage({ sender, message, sentAt }) {
    const row = document.createElement("div");
    const isMine = sender === currentUser;

    row.className = `message-row${isMine ? " mine" : ""}`;

    const senderLabel = document.createElement("div");
    senderLabel.className = "message-sender";
    senderLabel.textContent = isMine ? "You" : (sender || "User");

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message ?? "";

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTime(sentAt);

    row.append(senderLabel, bubble, time);
    messages.appendChild(row);

    messages.scrollTop = messages.scrollHeight;
}

/* --------------------------
   Logout
-------------------------- */

logoutBtn.addEventListener("click", async () => {
    await stopConnection();

    localStorage.removeItem("accessToken");
    localStorage.removeItem("chatUsername");

    groupsList.replaceChildren();
    messages.replaceChildren();
    newGroupForm.classList.add("hidden");

    displayUsername("");
    showAuth();
    showLoginForm();
});

/* --------------------------
   Restore UI after refresh
-------------------------- */

async function restoreSession() {
    const token = getToken();
    const savedName = localStorage.getItem("chatUsername");

    if (!token || !savedName) {
        showAuth();
        return;
    }

    displayUsername(savedName);
    showChat();

    try {
        await startConnection();
        await loadGroups();
    } catch (error) {
        console.error("Could not restore chat session:", error);
        setChatNotice(
            "Could not connect. Please log in again.",
            true
        );
    }
}

restoreSession();
