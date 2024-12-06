const socket = new WebSocket("ws://localhost:5088/ws");

socket.onopen = function () {
  console.log("WebSocket открыт.");
  checkAuth();
};

socket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  handleResponse(data);
};

socket.onclose = function () {
  console.log("WebSocket закрыт.");
};

socket.onerror = function (error) {
  console.log("Ошибка WebSocket:", error);
};

function sendMessage(message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.log("WebSocket не открыт.");
  }
}

function handleResponse(data) {
  console.log(data);
  switch (data.action) {
    case "login":
    case "register":
      if (data.status === "success") {
        localStorage.setItem("auth_token", data.auth_token);
        showNotesContainer();
        getNotesStructure();
      } else {
        alert("Ошибка: " + data.message);
      }
      break;
    case "get_note_structure":
      if (data.status === "success") {
        renderNotesTree(data.structure);
        updateFolderSelect(data.structure);
      } else {
        alert("Ошибка получения заметок: " + data.message);
      }
      break;
    case "create_note":
    case "edit_note":
    case "delete_note":
      if (data.status === "success") {
        getNotesStructure();
        closeModal();
      } else {
        alert("Ошибка: " + data.message);
      }
      break;
    case "share_note":
      if (data.status === "success") {
        alert("Ссылка для доступа: " + data.shareUrl);
      } else {
        alert("Ошибка: " + data.message);
      }
      break;
    default:
      console.log("Неизвестное действие:", data.action);
  }
}

function checkAuth() {
  const authToken = localStorage.getItem("auth_token");
  if (authToken) {
    showNotesContainer();
    getNotesStructure();
  } else {
    document.getElementById("auth-container").style.display = "block";
  }
}

document.getElementById("login-btn").addEventListener("click", function () {
  const username = document.getElementById("username").value;
  const passwordHash = md5(document.getElementById("password").value);
  sendMessage({ action: "login", username: username, password_hash: passwordHash });
});

document.getElementById("register-btn").addEventListener("click", function () {
  const username = document.getElementById("username").value;
  const passwordHash = md5(document.getElementById("password").value);
  sendMessage({ action: "register", username: username, password_hash: passwordHash });
});

document.getElementById("logout-btn").addEventListener("click", function () {
  localStorage.removeItem("auth_token");
  document.getElementById("notes-container").style.display = "none";
  document.getElementById("auth-container").style.display = "block";
});

function showNotesContainer() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("notes-container").style.display = "block";
}

function getNotesStructure() {
  const authToken = localStorage.getItem("auth_token");
  sendMessage({ action: "get_note_structure", auth_token: authToken });
}

document.getElementById("add-folder-btn").addEventListener("click", function () {
  openModal("Создать папку", true);
});

document.getElementById("add-note-btn").addEventListener("click", function () {
  openModal("Создать заметку", false);
});

document.getElementById("save-item-btn").onclick = function () {
  const authToken = localStorage.getItem("auth_token");
  const title = document.getElementById("item-title").value;
  const text = document.getElementById("item-text").value;
  const isFolder = document.getElementById("modal").dataset.isFolder === "true";
  const isEditing = document.getElementById("modal").dataset.editing === "true";
  const itemId = document.getElementById("modal").dataset.itemId;
  const parentId = document.getElementById("parent-folder").value;

  const message = {
    action: isEditing ? "edit_note" : "create_note",
    auth_token: authToken,
    title: title,
    text: text,
    is_folder: isFolder
  };

  if (parentId) {
    message.parent_id = parseInt(parentId);
  }

  if (isEditing) {
    message.id = parseInt(itemId);
  }

  sendMessage(message);
};

document.getElementById("close-modal").addEventListener("click", function () {
  closeModal();
});

function openModal(title, isFolder) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal").style.display = "block";
  document.getElementById("modal").dataset.isFolder = isFolder;
  if (isFolder) {
    document.getElementById("item-text").style.display = "none";
  } else {
    document.getElementById("item-text").style.display = "block";
  }
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("item-title").value = "";
  document.getElementById("item-text").value = "";
}

function renderNotesTree(structure) {
  const container = document.getElementById("notes-tree");
  container.innerHTML = "";
  structure.forEach(item => {
    renderNotesTreeRecursive(item, container);
  });
}

function renderNotesTreeRecursive(item, container) {
  const itemElement = document.createElement("div");
  itemElement.className = "note-item";

  const titleElement = document.createElement("span");
  titleElement.textContent = item.title;
  itemElement.appendChild(titleElement);

  const actionsContainer = createItemActions(item);
  itemElement.appendChild(actionsContainer);

  if (item.is_folder) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "children-container";
    itemElement.appendChild(childrenContainer);

    item.children.forEach(function (child) {
      renderNotesTreeRecursive(child, childrenContainer);
    });
  } else {
    const textElement = document.createElement("p");
    textElement.textContent = item.text;
    itemElement.appendChild(textElement);
  }

  container.appendChild(itemElement);
}

function createItemActions(item) {
  const actionsContainer = document.createElement("span");
  actionsContainer.className = "item-actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "✎";
  editBtn.title = "Редактировать";
  editBtn.addEventListener("click", function () {
    openEditModal(item);
  });
  actionsContainer.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑";
  deleteBtn.title = "Удалить";
  deleteBtn.addEventListener("click", function () {
    if (confirm("Вы уверены, что хотите удалить?")) {
      const authToken = localStorage.getItem("auth_token");
      sendMessage({ action: "delete_note", auth_token: authToken, id: item.id });
    }
  });
  actionsContainer.appendChild(deleteBtn);

  const shareBtn = document.createElement("button");
  shareBtn.textContent = "🔗";
  shareBtn.title = "Поделиться";
  shareBtn.addEventListener("click", function () {
    const authToken = localStorage.getItem("auth_token");
    sendMessage({ action: "share_note", auth_token: authToken, id: item.id });
  });
  actionsContainer.appendChild(shareBtn);

  return actionsContainer;
}

function openEditModal(item) {
  document.getElementById("modal-title").textContent = "Редактировать";
  document.getElementById("modal").style.display = "block";
  document.getElementById("item-title").value = item.title;
  document.getElementById("item-text").value = item.text || "";
  document.getElementById("modal").dataset.isFolder = item.is_folder;
  document.getElementById("modal").dataset.editing = "true";
  document.getElementById("modal").dataset.itemId = item.id;

  if (item.is_folder) {
    document.getElementById("item-text").style.display = "none";
  } else {
    document.getElementById("item-text").style.display = "block";
  }

  if (item.parent_id) {
    document.getElementById("parent-folder").value = item.parent_id;
  } else {
    document.getElementById("parent-folder").value = "";
  }
  
  document.getElementById("save-item-btn").onclick = function () {
    const authToken = localStorage.getItem("auth_token");
    const title = document.getElementById("item-title").value;
    const text = document.getElementById("item-text").value;
    const parentId = document.getElementById("parent-folder").value; 

    sendMessage({
      action: "edit_note",
      auth_token: authToken,
      id: item.id,
      title: title,
      text: text,
      parent_id: parentId ? parseInt(parentId) : null 
    });
  };
}

function updateFolderSelect(structure, parentId = null) {
  const select = document.getElementById('parent-folder');
  select.innerHTML = '<option value="">Без папки</option>';

  function addOptions(items, level = 0) {
    items.forEach(item => {
      if (item.is_folder && item.id !== parseInt(parentId)) {
        const option = document.createElement('option');
        option.value = item.id;
        option.text = '  '.repeat(level) + item.title;
        select.appendChild(option);

        if (item.children) {
          addOptions(item.children, level + 1);
        }
      }
    });
  }

  addOptions(structure);
}