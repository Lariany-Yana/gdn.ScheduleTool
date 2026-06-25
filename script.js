// =========================================================================
// Инструмент составления расписания (Schedule Tool)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".Tool .container");
  const template = document.getElementById("tool-card-template");
  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove")) {
      const card = e.target.closest(".tool-card");
      const dropZone = card.closest(".drop-zone"); // Находим родительскую зону

      if (card) {
        card.remove();
        // Пересчитываем время в этой зоне после удаления
        if (dropZone) reorderCardsInZone(dropZone);
      }
    }
  });

  const currentBaseDate = new Date();
  const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

  if (!container || !template) return;

  // --- 1. Наблюдатель за левой панелью ---
  // Делает карточки перетаскиваемыми без вмешательства в orders-module.js
  function makeCardsDraggable() {
    const cards = document.querySelectorAll('.order-card:not([draggable="true"])');
    cards.forEach((card) => card.setAttribute("draggable", "true"));
  }

  // Следим за изменениями в основном контейнере заказов
  const ordersContainer = document.querySelector("#orders");
  if (ordersContainer) {
    const observer = new MutationObserver(makeCardsDraggable);
    observer.observe(ordersContainer, { childList: true, subtree: true });
  }
  // Первичный запуск для уже отрендеренных карточек
  makeCardsDraggable();

  // --- 2. Генерация дней недели ---
  function renderWeek(baseDate) {
    container.innerHTML = "";
    let dayOfWeek = baseDate.getDay();
    // Смещение до понедельника
    let distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + distanceToMonday);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);

      const dayName = dayNames[currentDate.getDay()];
      const dd = String(currentDate.getDate()).padStart(2, "0");
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const yy = String(currentDate.getFullYear()).slice(-2);

      const section = document.createElement("section");
      section.className = "card-section";

      const h2 = document.createElement("h2");
      h2.className = "card-section-name";
      h2.textContent = `${dayName} ${dd}.${mm}.${yy}`;

      const dropZone = document.createElement("div");
      // Совмещаем класс контейнера карточек и зоны сброса
      dropZone.className = "card-container drop-zone";
      dropZone.style.minHeight = "60px";

      section.appendChild(h2);
      section.appendChild(dropZone);
      fragment.appendChild(section);
    }

    container.appendChild(fragment);
  }

  // --- 3. Математика расчета времени ---
  function calculateNextTime(dropZone) {
    const existingCards = dropZone.querySelectorAll(".tool-card");

    // Если день пустой — стартовое время 15:00
    if (existingCards.length === 0) return "15:00";

    // Берем данные из последней добавленной карточки
    const lastCard = existingCards[existingCards.length - 1];
    const timeText = lastCard.querySelector(".time").textContent;
    const slotText = lastCard.querySelector(".slot").textContent;

    const [hoursStr, minutesStr] = timeText.split(":");
    let hours = parseInt(hoursStr, 10);
    const slots = parseInt(slotText, 10) || 1;

    // Прибавляем время (1 слот = 2 часа)
    hours = hours + slots * 2;

    // Корректировка, если время переходит за полночь
    if (hours >= 24) hours = hours % 24;

    return `${String(hours).padStart(2, "0")}:${minutesStr}`;
  }

  // --- 4. Логика Drag-and-Drop ---
  document.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".order-card");
    if (!card) return;
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "copy";
  });

  container.addEventListener("dragover", (e) => {
    const dropZone = e.target.closest(".drop-zone");
    if (!dropZone) return;

    e.preventDefault(); // Обязательно для разрешения сброса элемента
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

    // Ищем оригинальную карточку слева
    const originalDomCard = document.getElementById(cardId);
    if (!originalDomCard) return;

    const nameRu = originalDomCard.querySelector(".name-ru")?.textContent || "";
    const nameEn = originalDomCard.querySelector(".name-en")?.textContent || "";

    // Создаем новую карточку расписания
    const clone = template.content.cloneNode(true);
    const toolCard = clone.querySelector(".tool-card");

    toolCard.querySelector(".time").textContent = calculateNextTime(dropZone);
    toolCard.querySelector(".slot").textContent = "1"; // Дефолтное значение
    toolCard.querySelector(".name-ru").textContent = nameRu;
    toolCard.querySelector(".name-en").textContent = nameEn;

    // Сохраняем связь с оригиналом
    toolCard.dataset.sourceId = cardId;

    dropZone.appendChild(toolCard);
    reorderCardsInZone(dropZone);
  });

  function reorderCardsInZone(dropZone) {
    const cards = dropZone.querySelectorAll(".tool-card");
    let currentTime = "15:00"; // Базовое время начала

    cards.forEach((card) => {
      // Обновляем время
      card.querySelector(".time").textContent = currentTime;

      // Вычисляем время для следующей карточки (+2 часа)
      const [hours, minutes] = currentTime.split(":");
      let nextHours = parseInt(hours) + 2;
      if (nextHours >= 24) nextHours = nextHours % 24;
      currentTime = `${String(nextHours).padStart(2, "0")}:${minutes}`;
    });
  }
  // --- Инициализация ---
  renderWeek(currentBaseDate);
});
