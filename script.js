// =========================================================================
// Инструмент составления расписания (Schedule Tool) с автоповтором и экспортом
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const toolPanel = document.querySelector(".Tool");
  const container = toolPanel.querySelector(".container");
  const template = document.getElementById("tool-card-template");
  
  // Кнопки навигации недель и копирования
  const btnBack = document.querySelector(".week .back");
  const btnNext = document.querySelector(".week .next");
  const btnCopy = document.querySelector(".copy-schedule");

  let currentBaseDate = new Date();
  let weekOffset = 0; 

  const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

  if (!container || !template) return;

  const STORAGE_PREFIX = "sched_data_";

  // Переменные для контроля удержания кнопки (автоповтор)
  let holdTimeout = null;
  let holdInterval = null;

  // Включаем кликабельность кнопки копирования (перебиваем pointer-events: none из CSS)
  if (btnCopy) {
    btnCopy.style.pointerEvents = "auto";
  }

  // --- 1. Наблюдатель за левой панелью ---
  function makeCardsDraggable() {
    const cards = document.querySelectorAll('.order-card:not([draggable="true"])');
    cards.forEach(card => card.setAttribute('draggable', 'true'));
  }

  const ordersContainer = document.querySelector('#orders'); 
  if (ordersContainer) {
    const observer = new MutationObserver(makeCardsDraggable);
    observer.observe(ordersContainer, { childList: true, subtree: true });
  }
  makeCardsDraggable(); 

  // --- Вспомогательные функции для времени ---
  function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  function formatMinutesToTime(minutes) {
    let h = Math.floor(minutes / 60) % 24;
    if (h < 0) h += 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // --- 2. Функция пересчета времени в конкретной зоне ---
  function reorderCardsInZone(dropZone) {
    const cards = dropZone.querySelectorAll(".tool-card");
    let currentTime = "15:00"; 

    cards.forEach((card, index) => {
      const timeValNode = card.querySelector(".time .value");
      const slotValNode = card.querySelector(".slot .value");

      if (index === 0) {
        if (!card.dataset.customTime) {
          timeValNode.textContent = currentTime;
        } else {
          currentTime = timeValNode.textContent;
        }
      } else {
        timeValNode.textContent = currentTime;
      }
      
      const slots = parseFloat(slotValNode.textContent) || 1;
      const durationMinutes = slots * 120; // 1 слот = 2 часа
      
      let currentMinutes = parseTimeToMinutes(currentTime);
      let nextMinutes = currentMinutes + durationMinutes;
      if (nextMinutes > 23 * 60) nextMinutes = 23 * 60; 
      
      currentTime = formatMinutesToTime(nextMinutes);
    });
  }

  // --- 3. Логика сохранения данных в localStorage ---
  function saveZoneData(dropZone) {
    const dateKey = dropZone.dataset.date;
    if (!dateKey) return;

    const cards = dropZone.querySelectorAll(".tool-card");
    const dataToSave = [];

    cards.forEach(card => {
      dataToSave.push({
        nameRu: card.querySelector(".name-ru")?.textContent || "",
        nameEn: card.querySelector(".name-en")?.textContent || "",
        time: card.querySelector(".time .value").textContent,
        slot: card.querySelector(".slot .value").textContent,
        customTime: card.dataset.customTime || ""
      });
    });

    if (dataToSave.length === 0) {
      localStorage.removeItem(STORAGE_PREFIX + dateKey);
    } else {
      localStorage.setItem(STORAGE_PREFIX + dateKey, JSON.stringify(dataToSave));
    }
  }

  // --- 4. Восстановление данных из кэша ---
  function loadZoneData(dropZone) {
    const dateKey = dropZone.dataset.date;
    if (!dateKey) return;

    const savedData = localStorage.getItem(STORAGE_PREFIX + dateKey);
    if (!savedData) return;

    try {
      const cardsData = JSON.parse(savedData);
      cardsData.forEach(data => {
        const clone = template.content.cloneNode(true);
        const toolCard = clone.querySelector(".tool-card");

        toolCard.querySelector(".name-ru").textContent = data.nameRu;
        toolCard.querySelector(".name-en").textContent = data.nameEn;
        toolCard.querySelector(".time .value").textContent = data.time || "15:00";
        toolCard.querySelector(".slot .value").textContent = data.slot || "1";
        if (data.customTime) toolCard.dataset.customTime = "true";

        dropZone.appendChild(toolCard);
      });
      reorderCardsInZone(dropZone);
    } catch (e) {
      console.error("Ошибка чтения кэша", e);
    }
  }

  // --- 5. Функция автоматической очистки старого кэша ---
  function cleanOldCache(baseDate) {
    const allowedKeys = new Set();
    [-1, 0, 1].forEach(offset => {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + (offset * 7));
      let dayOfWeek = targetDate.getDay();
      let distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(targetDate);
      monday.setDate(targetDate.getDate() + distanceToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        allowedKeys.add(`${STORAGE_PREFIX}${dd}.${mm}.${yy}`);
      }
    });

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        if (!allowedKeys.has(key)) localStorage.removeItem(key);
      }
    }
  }

  // --- 6. Генерация дней недели ---
  function renderWeek(baseDate) {
    container.innerHTML = "";
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + (weekOffset * 7));

    let dayOfWeek = targetDate.getDay();
    let distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() + distanceToMonday);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);

      const dayName = dayNames[currentDate.getDay()];
      const dd = String(currentDate.getDate()).padStart(2, "0");
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const yy = String(currentDate.getFullYear()).slice(-2);
      const formattedDate = `${dd}.${mm}.${yy}`;

      const section = document.createElement("section");
      section.className = "card-section";

      const h2 = document.createElement("h2");
      h2.className = "card-section-name";
      h2.textContent = `${dayName} ${formattedDate}`;

      const dropZone = document.createElement("div");
      dropZone.className = "card-container drop-zone";
      dropZone.dataset.date = formattedDate;

      section.appendChild(h2);
      section.appendChild(dropZone);
      fragment.appendChild(section);

      loadZoneData(dropZone);
    }

    container.appendChild(fragment);
    updateNavigationButtons();
  }

  function updateNavigationButtons() {
    if (!btnBack || !btnNext) return;
    btnBack.style.display = weekOffset <= -1 ? "none" : "block";
    btnNext.style.display = weekOffset >= 1 ? "none" : "block";
  }

  if (btnBack) btnBack.addEventListener("click", () => { if (weekOffset > -1) { weekOffset--; renderWeek(currentBaseDate); } });
  if (btnNext) btnNext.addEventListener("click", () => { if (weekOffset < 1) { weekOffset++; renderWeek(currentBaseDate); } });

  // --- Изолированные функции изменения значений для автоповтора ---
  function modifyTime(target) {
    const card = target.closest(".tool-card");
    const dropZone = card.closest(".drop-zone");
    const valueNode = card.querySelector(".time .value");
    
    let currentMinutes = parseTimeToMinutes(valueNode.textContent);

    if (target.classList.contains("increment")) {
      currentMinutes += 30;
    } else if (target.classList.contains("decrement")) {
      currentMinutes -= 30;
    }

    if (currentMinutes < 0) currentMinutes = 0;
    if (currentMinutes > 23.5 * 60) currentMinutes = 23.5 * 60;

    valueNode.textContent = formatMinutesToTime(currentMinutes);
    card.dataset.customTime = "true"; 

    reorderCardsInZone(dropZone);
    saveZoneData(dropZone);
  }

  // Изменение слотов
  function modifySlot(target) {
    const card = target.closest(".tool-card");
    const dropZone = card.closest(".drop-zone");
    const valueNode = card.querySelector(".slot .value");

    let currentSlots = parseFloat(valueNode.textContent) || 1;

    if (target.classList.contains("increment")) {
      currentSlots += 0.5;
    } else if (target.classList.contains("decrement")) {
      currentSlots = Math.max(0.5, currentSlots - 0.5); 
    }

    valueNode.textContent = currentSlots;

    reorderCardsInZone(dropZone);
    saveZoneData(dropZone);
  }

  function clearHoldTimers() {
    if (holdTimeout) clearTimeout(holdTimeout);
    if (holdInterval) clearInterval(holdInterval);
    holdTimeout = null;
    holdInterval = null;
  }

  // --- 7. Обработка нажатий мыши (mousedown) с поддержкой автоповтора ---
  container.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("remove")) {
      const card = e.target.closest(".tool-card");
      if (card) {
        const dropZone = card.closest(".drop-zone");
        card.remove();
        if (dropZone) { reorderCardsInZone(dropZone); saveZoneData(dropZone); }
      }
      return;
    }

    const target = e.target;
    const isTimeBtn = target.closest(".time") && (target.classList.contains("increment") || target.classList.contains("decrement"));
    const isSlotBtn = target.closest(".slot") && (target.classList.contains("increment") || target.classList.contains("decrement"));

    if (!isTimeBtn && !isSlotBtn) return;

    if (isTimeBtn) modifyTime(target);
    if (isSlotBtn) modifySlot(target);

    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => {
        if (isTimeBtn) modifyTime(target);
        if (isSlotBtn) modifySlot(target);
      }, 100);
    }, 500);
  });

  window.addEventListener("mouseup", clearHoldTimers);
  container.addEventListener("mouseleave", clearHoldTimers);

  // --- 8. Логика формирования текста и копирования расписания ---
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const sections = container.querySelectorAll(".card-section");
      let outputText = "";

      // Форматтер для перевода дат в формат "ДД.ММ.ГГ" по МСК
      const mskFormatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });

      // Текущее время в Москве
      const nowMsk = new Date();
      const currentMskDateStr = mskFormatter.format(nowMsk);

      // Завтрашнее время в Москве (+1 день к текущему моменту)
      const tomorrowMsk = new Date(nowMsk);
      tomorrowMsk.setDate(nowMsk.getDate() + 1);
      const tomorrowMskDateStr = mskFormatter.format(tomorrowMsk);

      sections.forEach((section) => {
        const dropZone = section.querySelector(".drop-zone");
        const zoneDate = dropZone ? dropZone.dataset.date : ""; // Наша строка вида "ДД.ММ.ГГ"

        let dayTitle = section.querySelector(".card-section-name")?.textContent || "";

        // Проверяем соответствие сегодняшнему или завтрашнему дню по МСК
        if (zoneDate && zoneDate === currentMskDateStr) {
          dayTitle = "Сегодня"; // Перезаписываем без даты
        } else if (zoneDate && zoneDate === tomorrowMskDateStr) {
          dayTitle = "Завтра";  // Перезаписываем без даты
        }

        outputText += dayTitle + "\n";

        const cards = section.querySelectorAll(".tool-card");
        cards.forEach((card) => {
          const time = card.querySelector(".time .value")?.textContent || "15:00";
          const nameRu = card.querySelector(".name-ru")?.textContent || "";
          outputText += `${time}: ${nameRu}\n`;
        });

        outputText += "\n";
      });

      outputText = outputText.trim() + "\n";

      navigator.clipboard.writeText(outputText)
        .then(() => {
          const originalText = btnCopy.textContent;
          btnCopy.textContent = "Скопировано!";
          btnCopy.style.opacity = "1";
          setTimeout(() => {
            btnCopy.textContent = originalText;
            btnCopy.style.opacity = "";
          }, 1500);
        })
        .catch((err) => {
          console.error("Не удалось скопировать расписание: ", err);
        });
    });
  }

  // --- 9. Логика Drag-and-Drop ---
  document.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".order-card");
    if (!card) return;
    if (!card.id) card.id = 'card-' + Math.random().toString(36).substr(2, 9);
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "copy";
  });

  container.addEventListener("dragover", (e) => {
    const dropZone = e.target.closest(".drop-zone");
    if (!dropZone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("drag-over");
  });

  container.addEventListener("dragleave", (e) => {
    const dropZone = e.target.closest(".drop-zone");
    if (dropZone) dropZone.classList.remove("drag-over");
  });

  container.addEventListener("drop", (e) => {
    const dropZone = e.target.closest(".drop-zone");
    if (!dropZone) return;

    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;

    const originalDomCard = document.getElementById(cardId);
    if (!originalDomCard) return;

    const nameRu = originalDomCard.querySelector(".name-ru")?.textContent || "";
    const nameEn = originalDomCard.querySelector(".name-en")?.textContent || "";

    const clone = template.content.cloneNode(true);
    const toolCard = clone.querySelector(".tool-card");

    toolCard.querySelector(".name-ru").textContent = nameRu;
    toolCard.querySelector(".name-en").textContent = nameEn;
    toolCard.querySelector(".time .value").textContent = "15:00";
    toolCard.querySelector(".slot .value").textContent = "1";

    toolCard.dataset.sourceId = cardId;
    dropZone.appendChild(toolCard);

    reorderCardsInZone(dropZone);
    saveZoneData(dropZone);
  });

  cleanOldCache(currentBaseDate);
  renderWeek(currentBaseDate);
});