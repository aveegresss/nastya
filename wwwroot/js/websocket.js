const socket = new WebSocket("ws://localhost:5089/ws");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const JPEG_QUALITY = 0.7;

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
      if (data.status === "success") {
        getNotesStructure(); 
        closeModal();
        document.getElementById('image-preview').innerHTML = '';
        document.getElementById('item-image').value = '';
      } else {
        alert("Ошибка: " + data.message);
      }
      break;
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
  openModal("Добавить фильтр", true);
});

document.getElementById("add-note-btn").addEventListener("click", function () {
  openModal("Загрузить картину", false);
});

document.getElementById("save-item-btn").onclick = async function () {
  const authToken = localStorage.getItem("auth_token");
  const title = document.getElementById("item-title").value;
  const text = document.getElementById("item-text").value;
  const imageInput = document.getElementById("item-image");
  const isFolder = document.getElementById("modal").dataset.isFolder === "true";
  const isEditing = document.getElementById("modal").dataset.editing === "true";
  const itemId = document.getElementById("modal").dataset.itemId;
  const parentId = document.getElementById("parent-folder").value;

  try {
    const message = {
      action: isEditing ? "edit_note" : "create_note",
      auth_token: authToken,
      title: title,
      text: text,
      is_folder: isFolder
    };

    // Добавляем изображение, если оно есть
    if (imageInput.files[0]) {
      const compressedImageBase64 = await compressImage(imageInput.files[0]);
      message.image = compressedImageBase64;
    }

    if (parentId) {
      message.parent_id = parseInt(parentId);
    }

    if (isEditing) {
      message.id = parseInt(itemId);
    }

    sendMessage(message);
  } catch (error) {
    alert('Ошибка при обработке изображения: ' + error);
    console.error(error);
  }
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
  // Создаем селект для папок
  const folderSelect = document.createElement('select');
  folderSelect.className = 'folder-select';
  folderSelect.innerHTML = '<option value="">Все картины</option>';
  folderSelect.className = "checkPictures";

  // Добавляем папки в селект
  function addFolderOptions(items, level = 0) {
    items.forEach(item => {
      if (item.is_folder) {
        const option = document.createElement('option');
        option.className = "checkVal";
        option.value = item.id;
        option.text = '  '.repeat(level) + item.title;
        folderSelect.appendChild(option);
        if (item.children) {
          addFolderOptions(item.children, level + 1);
        }
      }
    });
  }
  addFolderOptions(structure);

  // Создаем контейнер для заметок
  const notesContent = document.createElement('div');
  notesContent.className = 'notes-content';

  // Обработчик изменения выбранной папки
  folderSelect.onchange = () => {
    const selectedFolderId = folderSelect.value;
    renderNotes(structure, selectedFolderId, notesContent);
  };

  // Очищаем и добавляем элементы
  const container = document.getElementById('notes-tree');
  container.innerHTML = '';
  container.appendChild(folderSelect);
  container.appendChild(notesContent);

  // Отображаем все заметки по умолчанию
  renderNotes(structure, '', notesContent);
}

function renderNotes(structure, folderId, container) {
  container.innerHTML = '';

  function findAndRenderNotes(items) {
    items.forEach(item => {

      if (!item.is_folder) {
        // Приводим parent_id и folderId к строкам для корректного сравнения
        const noteParentId = item.parent_id ? item.parent_id.toString() : '';
        const selectedFolderId = folderId ? folderId.toString() : '';

        const showNote =
          !selectedFolderId || // Показывать все если папка не выбрана  
          (noteParentId === selectedFolderId); // Показывать заметки выбранной папки

        if (showNote) {
          console.log('Добавляем заметку:', item.title);
          const noteElement = createNoteElement(item);
          container.appendChild(noteElement);
        }
      }

      if (item.children && item.children.length > 0) {
        findAndRenderNotes(item.children);
      }
    });
  }

  findAndRenderNotes(structure);

  if (container.children.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = folderId ? 'В этой папке нет заметок' : 'Нет заметок';
    container.appendChild(emptyMessage);
  }
}

function createNoteElement(item) {
  const noteElement = document.createElement('div');
  noteElement.className = 'note-item';

  const titleElement = document.createElement('div');
  titleElement.className = 'note-title';
  titleElement.textContent = item.title;
  noteElement.appendChild(titleElement);

  if (item.image_path) {
    const imageElement = document.createElement('img');
    imageElement.src = item.image_path;
    imageElement.className = 'note-image';
    imageElement.alt = 'Изображение к заметке';
    noteElement.appendChild(imageElement);
  }

  const textElement = document.createElement('div');
  textElement.className = 'note-text';
  textElement.textContent = item.text;
  noteElement.appendChild(textElement);

  const actionsContainer = createItemActions(item);
  noteElement.appendChild(actionsContainer);

  return noteElement;
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

document.getElementById('item-image').addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      this.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('Размер файла не должен превышать 10MB');
      this.value = '';
      return;
    }

    try {
      const compressedImageBase64 = await compressImage(file);
      const preview = document.getElementById('image-preview');

      // Показываем изображение напрямую через data URL
      preview.innerHTML = `
        <img 
          src="data:image/jpeg;base64,${compressedImageBase64}" 
          alt="Предварительный просмотр"
          style="max-width: 100%; max-height: 300px; object-fit: contain;"
        >`;

    } catch (error) {
      alert('Ошибка при обработке изображения: ' + error);
      console.error(error);
      this.value = '';
    }
  }
});

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const maxDimension = 600;
            if (width > height) {
              if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Получаем только данные Base64, без префикса data:image/jpeg;base64,
            const compressedData = canvas.toDataURL('image/jpeg', 0.3).split(',')[1];

            if (compressedData.length > 500 * 1024) {
              reject('Изображение слишком большое даже после сжатия');
              return;
            }

            resolve(compressedData); // Отправляем только Base64 данные
          } catch (err) {
            reject(`Ошибка при сжатии изображения: ${err.message}`);
          }
        };
        img.onerror = () => reject('Ошибка загрузки изображения');
        img.src = e.target.result;
      };
      reader.onerror = () => reject('Ошибка чтения файла');
      reader.readAsDataURL(file);
    } catch (err) {
      reject(`Общая ошибка обработки: ${err.message}`);
    }
  });
}
