const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3012; // Используем переменную окружения или 3012

app.use(cors());
app.use(express.json());

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

const uploadDir = "./uploads";
const screenshotDir = "./uploads/screenshots";

// Создаем папки если их нет
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

app.use("/uploads", express.static(uploadDir));

// Добавляем статические файлы фронта
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Маршрут для всех остальных запросов (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/reports", async (req, res) => {
  const { channelUrl, startDate, endDate } = req.body;

  if (!channelUrl || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: "Необходимы channelUrl, startDate и endDate",
    });
  }

  const id = Date.now();
  const username = channelUrl.replace("https://t.me/", "").replace("@", "");

  log(`📝 Получен запрос: ${channelUrl}, ${startDate} - ${endDate}`);
  log(`🆔 Создаем отчет ${id} для канала ${username}`);

  // Отправляем ответ сразу
  res.json({
    success: true,
    id: id,
    message: "Отчет создается...",
  });

  // Обрабатываем в фоне
  log("🚀 Начинаем обработку в фоне...");
  try {
    const result = await processChannel(username, startDate, endDate);

    log(`📊 Подготавливаем данные отчета:`);
    log(
      `   Скриншотов в результате: ${
        result.screenshots ? result.screenshots.length : 0
      }`
    );

    const reportData = {
      id: id,
      channel_url: channelUrl,
      channel_username: username,
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
      total_posts: result.total,
      posts_in_period: result.inPeriod,
      posts_details: result.details,
      screenshots: result.screenshots || [],
      stats: result.stats || {
        totalChars: 0,
        avgChars: 0,
        postsWithText: 0,
      },
    };

    log(`   Скриншотов в отчете: ${reportData.screenshots.length}`);

    const reportPath = path.join(uploadDir, `report_${id}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    log(`💾 Сохраняем отчет в ${reportPath}`);
    log("✅ Отчет успешно сохранен");
  } catch (error) {
    log(`❌ Ошибка при создании отчета: ${error.message}`);
  }
});

app.get("/api/reports/:id", (req, res) => {
  const { id } = req.params;
  log(`📋 Запрос отчета ${id}`);

  try {
    const reportPath = path.join(uploadDir, `report_${id}.json`);

    if (fs.existsSync(reportPath)) {
      log(`✅ Отчет ${id} найден`);
      const reportData = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      res.json({
        success: true,
        data: reportData,
      });
    } else {
      log(`❌ Отчет ${id} не найден`);
      res.status(404).json({
        success: false,
        error: "Отчет не найден",
      });
    }
  } catch (error) {
    log(`❌ Ошибка при получении отчета: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Ошибка при получении отчета",
    });
  }
});

async function processChannel(channelUsername, startDate, endDate) {
  log(`📊 Обрабатываем канал @${channelUsername} с ${startDate} по ${endDate}`);

  let browser = null;

  try {
    log("🌐 Запускаем браузер...");
    browser = await puppeteer.launch({
      headless: true, // Полностью скрытый режим
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    });

    log("✅ Браузер запущен, создаем страницу...");
    const page = await browser.newPage();

    log("🔧 Устанавливаем User-Agent...");
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Отслеживаем сетевые запросы без блокировки
    const apiRequests = [];

    page.on("request", (request) => {
      if (
        request.url().includes("api.telegram.org") ||
        request.url().includes("t.me")
      ) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
        });
        log(`   📡 API запрос: ${request.method()} ${request.url()}`);
      }
    });

    page.on("response", (response) => {
      if (
        response.url().includes("api.telegram.org") ||
        response.url().includes("t.me")
      ) {
        log(`   📡 API ответ: ${response.status()} ${response.url()}`);
      }
    });

    // Модифицируем поведение страницы для лучшей прокрутки
    await page.evaluateOnNewDocument(() => {
      // Переопределяем scrollTo для лучшей работы
      const originalScrollTo = window.scrollTo;
      window.scrollTo = function (x, y) {
        console.log(`Прокрутка к: ${x}, ${y}`);
        return originalScrollTo.call(this, x, y);
      };

      // Добавляем обработчик для автоматической загрузки
      let isLoading = false;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoading) {
            isLoading = true;
            console.log("Элемент видим, загружаем больше контента...");
            // Симулируем прокрутку
            setTimeout(() => {
              window.scrollTo(0, document.body.scrollHeight);
              isLoading = false;
            }, 1000);
          }
        });
      });

      // Наблюдаем за последним элементом
      const observeLastElement = () => {
        const messages = document.querySelectorAll(".tgme_widget_message");
        if (messages.length > 0) {
          observer.observe(messages[messages.length - 1]);
        }
      };

      // Запускаем наблюдение
      setTimeout(observeLastElement, 2000);
    });

    const channelUrl = `https://t.me/${channelUsername}`;
    log(`📱 Открываем ${channelUrl}...`);

    // Пробуем загрузить страницу с повторными попытками
    let pageLoaded = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!pageLoaded && attempts < maxAttempts) {
      attempts++;
      try {
        log(`   Попытка ${attempts}/${maxAttempts} загрузки страницы...`);
        await page.goto(channelUrl, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        pageLoaded = true;
        log("✅ Страница канала загружена");
      } catch (error) {
        log(`   ❌ Попытка ${attempts} не удалась: ${error.message}`);
        if (attempts < maxAttempts) {
          log(`   ⏳ Ждем 5 секунд перед следующей попыткой...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          log(`   ⚠️ Пробуем альтернативный способ загрузки...`);
          try {
            await page.goto(channelUrl, {
              waitUntil: "load",
              timeout: 60000,
            });
            pageLoaded = true;
            log("✅ Страница загружена альтернативным способом");
          } catch (altError) {
            throw new Error(
              `Не удалось загрузить страницу после ${maxAttempts} попыток: ${altError.message}`
            );
          }
        }
      }
    }

    // Проверяем заголовок страницы
    const pageTitle = await page.title();
    log(`📄 Заголовок страницы: ${pageTitle}`);

    // Проверяем, что страница загрузилась правильно
    const currentUrl = page.url();
    log(`🔗 Текущий URL: ${currentUrl}`);

    if (!currentUrl.includes(channelUsername)) {
      throw new Error(
        `Страница не загрузилась правильно. Ожидался канал ${channelUsername}, получен URL: ${currentUrl}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    log("⏳ Ждем 5 секунд для загрузки...");

    // Пытаемся найти и нажать кнопку "Preview Channel"
    log("🔍 Ищем кнопку Preview Channel...");
    const previewButtonClicked = await page.evaluate(() => {
      // Ищем кнопку по разным селекторам
      const selectors = [
        'button[data-action="preview"]',
        ".tgme_action_button",
        'button:contains("Preview")',
        'a[href*="preview"]',
        ".tgme_widget_message_wrap button",
        'button[class*="preview"]',
        'button[class*="action"]',
      ];

      for (const selector of selectors) {
        try {
          const button = document.querySelector(selector);
          if (button && button.offsetParent !== null) {
            // Проверяем что кнопка видима
            button.click();
            console.log(`Нажата кнопка: ${selector}`);
            return true;
          }
        } catch (e) {
          console.log(`Ошибка при поиске кнопки ${selector}:`, e);
        }
      }

      // Ищем по тексту
      const buttons = document.querySelectorAll("button, a");
      for (const button of buttons) {
        const text = button.textContent.toLowerCase();
        if (
          text.includes("preview") ||
          text.includes("просмотр") ||
          text.includes("канал")
        ) {
          if (button.offsetParent !== null) {
            button.click();
            console.log(`Нажата кнопка по тексту: ${text}`);
            return true;
          }
        }
      }

      return false;
    });

    if (previewButtonClicked) {
      log("✅ Кнопка Preview Channel нажата");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      log("⏳ Ждем 3 секунды после нажатия кнопки...");
    } else {
      log("⚠️ Кнопка Preview Channel не найдена, продолжаем...");
    }

    // Проверяем, есть ли посты на странице
    const initialPosts = await page.evaluate(() => {
      const posts = document.querySelectorAll(".tgme_widget_message");
      return posts.length;
    });
    log(`🔍 Найдено постов при первой проверке: ${initialPosts}`);

    // Если постов нет, пытаемся еще раз найти кнопку
    if (initialPosts === 0) {
      log("⚠️ Посты не найдены, пытаемся еще раз найти кнопку...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const retryButtonClicked = await page.evaluate(() => {
        // Ищем все кнопки и ссылки на странице
        const allElements = document.querySelectorAll(
          'button, a, [role="button"]'
        );
        for (const element of allElements) {
          const text = element.textContent.toLowerCase();
          const className = element.className.toLowerCase();
          const href = element.href || "";

          // Проверяем различные варианты
          if (
            text.includes("preview") ||
            text.includes("просмотр") ||
            text.includes("канал") ||
            text.includes("view") ||
            className.includes("preview") ||
            className.includes("action") ||
            href.includes("preview")
          ) {
            if (element.offsetParent !== null) {
              element.click();
              console.log(`Повторно нажата кнопка: ${text} (${className})`);
              return true;
            }
          }
        }
        return false;
      });

      if (retryButtonClicked) {
        log("✅ Кнопка найдена и нажата повторно");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // Попробуем альтернативный подход - прямой доступ к постам
    log("🔍 Пробуем альтернативный подход для загрузки старых постов...");

    // Сначала попробуем найти кнопку "View in Telegram" и перейти в приложение
    const viewInTelegramButton = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button, a");
      for (const button of buttons) {
        const text = button.textContent.toLowerCase();
        if (
          text.includes("view in telegram") ||
          text.includes("open in telegram")
        ) {
          return button.href || button.getAttribute("data-href");
        }
      }
      return null;
    });

    if (viewInTelegramButton) {
      log(`   🔗 Найдена ссылка в Telegram: ${viewInTelegramButton}`);
    }

    // Переходим на страницу с постами
    log("🌐 Переходим на страницу с постами...");

    try {
      // Переходим на страницу с постами
      const postsUrl = `https://t.me/s/${channelUsername}`;
      log(`   🔗 Переходим на ${postsUrl}`);

      await page.goto(postsUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      log("✅ Страница с постами загружена");

      // Ждем загрузки постов с повторными попытками
      let postsCount = 0;
      let attempts = 0;
      const maxAttempts = 5;

      while (postsCount <= 20 && attempts < maxAttempts) {
        attempts++;
        log(`   ⏳ Попытка ${attempts}/${maxAttempts} загрузки постов...`);

        // Ждем загрузки постов
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Проверяем количество постов
        postsCount = await page.evaluate(() => {
          return document.querySelectorAll(".tgme_widget_message").length;
        });

        log(`   📊 Постов на странице (попытка ${attempts}): ${postsCount}`);

        if (postsCount <= 20 && attempts < maxAttempts) {
          log(
            `   ⚠️ Мало постов, пробуем прокрутку ВВЕРХ для загрузки старых постов...`
          );
          // Пробуем дополнительную прокрутку ВВЕРХ для загрузки
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            window.scrollBy(0, -2000);
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (postsCount <= 20) {
        log(
          `   ⚠️ Предупреждение: Загружено только ${postsCount} постов, возможно нужно больше прокрутки`
        );
      } else {
        log(`   ✅ Успешно загружено ${postsCount} постов`);
      }
    } catch (error) {
      log(`   ⚠️ Ошибка при переходе на страницу с постами: ${error.message}`);
    }

    // Теперь попробуем умную прокрутку с другими методами
    log("📜 Начинаем умную прокрутку для поиска постов нужной даты...");
    const maxScrolls = 200; // Увеличиваем лимит еще больше для загрузки большего количества постов
    let scrollCount = 0;
    let foundTargetDate = false;
    let lastCheckedDate = null;
    let lastPostCount = 0;
    let noProgressCount = 0;

    // Получаем начальное количество постов
    lastPostCount = await page.evaluate(() => {
      return document.querySelectorAll(".tgme_widget_message").length;
    });
    log(`   📊 Начальное количество постов: ${lastPostCount}`);

    // Сначала делаем агрессивную прокрутку ВВЕРХ для загрузки старых постов
    log(
      "   🔄 Начинаем агрессивную начальную прокрутку ВВЕРХ для загрузки старых постов..."
    );
    for (let initScroll = 0; initScroll < 15; initScroll++) {
      await page.evaluate(() => {
        // Прокручиваем ВВЕРХ для загрузки старых постов
        window.scrollTo(0, 0);
        window.scrollBy(0, -3000);

        // Дополнительная прокрутка вверх
        setTimeout(() => {
          window.scrollBy(0, -2000);
        }, 100);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Проверяем прогресс каждые 3 прокрутки
      if (initScroll % 3 === 0) {
        const currentPosts = await page.evaluate(() => {
          return document.querySelectorAll(".tgme_widget_message").length;
        });
        log(
          `   📊 Постов после ${
            initScroll + 1
          } начальных прокруток ВВЕРХ: ${currentPosts}`
        );
      }
    }

    // Обновляем количество постов после начальной прокрутки
    lastPostCount = await page.evaluate(() => {
      return document.querySelectorAll(".tgme_widget_message").length;
    });
    log(`   📊 Постов после начальной прокрутки: ${lastPostCount}`);

    for (let i = 0; i < maxScrolls && !foundTargetDate; i++) {
      scrollCount++;

      // Прокрутка ВВЕРХ для загрузки старых постов
      await page.evaluate(() => {
        // Прокручиваем ВВЕРХ на 2000px для загрузки старых постов
        window.scrollBy(0, -2000);

        // Также прокручиваем к самому верху страницы
        window.scrollTo(0, 0);

        // Дополнительная прокрутка вверх для активации загрузки
        setTimeout(() => {
          window.scrollBy(0, -1000);
        }, 500);
      });

      // Ждем загрузки новых постов
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Проверяем даты каждые 5 прокруток в начале, потом каждые 10
      if (scrollCount % (scrollCount <= 20 ? 5 : 10) === 0) {
        log(`   📊 Проверка после ${scrollCount} прокруток...`);

        const dateCheck = await page.evaluate(
          (startDate, endDate) => {
            const posts = document.querySelectorAll(".tgme_widget_message");
            let totalPosts = posts.length;
            let earliestDate = null;
            let latestDate = null;
            let foundTarget = false;

            posts.forEach((post) => {
              const timeElement = post.querySelector(
                ".tgme_widget_message_date time"
              );
              if (timeElement) {
                const dateText = timeElement.getAttribute("datetime");
                if (dateText) {
                  const postDate = new Date(dateText);
                  const postDateOnly = new Date(
                    postDate.getFullYear(),
                    postDate.getMonth(),
                    postDate.getDate()
                  );

                  if (!earliestDate || postDateOnly < earliestDate) {
                    earliestDate = postDateOnly;
                  }
                  if (!latestDate || postDateOnly > latestDate) {
                    latestDate = postDateOnly;
                  }

                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  const startDateOnly = new Date(
                    start.getFullYear(),
                    start.getMonth(),
                    start.getDate()
                  );
                  const endDateOnly = new Date(
                    end.getFullYear(),
                    end.getMonth(),
                    end.getDate()
                  );

                  if (
                    postDateOnly >= startDateOnly &&
                    postDateOnly <= endDateOnly
                  ) {
                    foundTarget = true;
                  }
                }
              }
            });

            return {
              totalPosts,
              earliestDate: earliestDate
                ? earliestDate.toISOString().split("T")[0]
                : null,
              latestDate: latestDate
                ? latestDate.toISOString().split("T")[0]
                : null,
              foundTarget,
            };
          },
          startDate,
          endDate
        );

        log(`      📈 Всего постов: ${dateCheck.totalPosts}`);
        log(`      📅 Проверено до даты: ${dateCheck.latestDate}`);
        log(`      📅 Самая ранняя дата: ${dateCheck.earliestDate}`);
        log(`      🎯 Ищем посты с: ${startDate} по ${endDate}`);

        if (dateCheck.foundTarget) {
          log(`      ✅ Найдены посты нужной даты! Останавливаем прокрутку`);
          foundTargetDate = true;
          break;
        } else {
          log(`      ⚠️ Посты нужной даты не найдены, продолжаем прокрутку`);
        }
      }

      // Проверяем, сколько постов загружено
      const currentPosts = await page.evaluate(() => {
        return document.querySelectorAll(".tgme_widget_message").length;
      });
      log(`   📊 Постов загружено на данный момент: ${currentPosts}`);

      // Проверяем прогресс загрузки
      if (currentPosts === lastPostCount) {
        noProgressCount++;
        log(`   ⚠️ Нет прогресса загрузки (${noProgressCount}/3)`);

        if (noProgressCount >= 3) {
          log(`   🚨 Нет прогресса загрузки после 3 попыток, останавливаемся`);
          break;
        }
      } else {
        noProgressCount = 0;
        log(`   ✅ Прогресс: +${currentPosts - lastPostCount} постов`);
      }

      lastPostCount = currentPosts;
    }

    if (!foundTargetDate) {
      log(`   ⚠️ Завершена прокрутка после ${scrollCount} попыток`);
    }

    // Получаем данные постов и создаем скриншоты
    log("🔍 Обрабатываем посты и создаем скриншоты...");
    const result = await page.evaluate(
      (startDate, endDate, channelUsername) => {
        const postElements = document.querySelectorAll(".tgme_widget_message");
        console.log(`Найдено элементов постов: ${postElements.length}`);

        const allPosts = [];
        const postsInPeriod = [];

        postElements.forEach((element, index) => {
          try {
            const fullPostId = element.getAttribute("data-post");
            // Извлекаем только номер поста из полного ID
            const postId = fullPostId ? fullPostId.split("/").pop() : null;
            console.log(
              `Обрабатываем пост ${
                index + 1
              }: полный ID = ${fullPostId}, ID = ${postId}`
            );
            const timeElement = element.querySelector(
              ".tgme_widget_message_date time"
            );
            const dateText = timeElement
              ? timeElement.getAttribute("datetime")
              : null;
            const dateDisplay = timeElement ? timeElement.textContent : null;

            if (postId && dateText) {
              // Сбор статистики только стандартными селекторами
              let views = "0";
              let forwards = "0";
              let replies = "0";
              try {
                const viewsElement = element.querySelector(
                  ".tgme_widget_message_views"
                );
                const forwardsElement = element.querySelector(
                  ".tgme_widget_message_forwards"
                );
                const repliesElement = element.querySelector(
                  ".tgme_widget_message_replies"
                );

                if (viewsElement && viewsElement.textContent.trim()) {
                  views = viewsElement.textContent.trim();
                }
                if (forwardsElement && forwardsElement.textContent.trim()) {
                  forwards = forwardsElement.textContent.trim();
                }
                if (repliesElement && repliesElement.textContent.trim()) {
                  replies = repliesElement.textContent.trim();
                }
              } catch (e) {
                views = "0";
                forwards = "0";
                replies = "0";
              }

              const postInfo = {
                id: postId,
                date: dateText,
                display: dateDisplay,
                index: index,
                views: views,
                forwards: forwards,
                replies: replies,
              };

              allPosts.push(postInfo);

              // Проверяем, подходит ли пост по дате
              const postDate = new Date(dateText);
              const start = new Date(startDate);
              const end = new Date(endDate);

              const postDateOnly = new Date(
                postDate.getFullYear(),
                postDate.getMonth(),
                postDate.getDate()
              );
              const startDateOnly = new Date(
                start.getFullYear(),
                start.getMonth(),
                start.getDate()
              );
              const endDateOnly = new Date(
                end.getFullYear(),
                end.getMonth(),
                end.getDate()
              );

              if (
                postDateOnly >= startDateOnly &&
                postDateOnly <= endDateOnly
              ) {
                postsInPeriod.push(postInfo);
                console.log(
                  `✅ Пост ${postId} подходит по дате: ${dateDisplay}`
                );
              }
            }
          } catch (error) {
            console.error("Ошибка при обработке поста:", error);
          }
        });

        // Извлекаем текст постов
        const postsWithText = [];
        postsInPeriod.forEach((post) => {
          // Ищем элемент поста по полному ID (с названием канала)
          const fullPostId = `${channelUsername}/${post.id}`;
          const postElement = document.querySelector(
            `[data-post="${fullPostId}"]`
          );
          let text = "";
          let cleanText = "";

          if (postElement) {
            console.log(`Найден элемент поста для ${post.id}`);
            const textElement = postElement.querySelector(
              ".tgme_widget_message_text"
            );
            if (textElement) {
              text = textElement.textContent.trim();
              console.log(
                `Найден текст поста ${post.id}: "${text.substring(0, 50)}..."`
              );
              // Очищаем текст от смайлов и ссылок
              cleanText = text
                .replace(
                  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
                  ""
                ) // Убираем эмодзи
                .replace(/https?:\/\/[^\s]+/g, "") // Убираем ссылки
                .replace(/\s+/g, " ") // Убираем лишние пробелы
                .trim();
              console.log(
                `Очищенный текст поста ${post.id}: "${cleanText.substring(
                  0,
                  50
                )}..."`
              );
            } else {
              console.log(`Текстовый элемент не найден для поста ${post.id}`);
            }
          } else {
            console.log(
              `Элемент поста не найден для ${post.id}, искали: [data-post="${fullPostId}"]`
            );
          }

          postsWithText.push({
            ...post,
            text: text,
            cleanText: cleanText,
            charCount: cleanText.length,
          });
        });

        // Группируем по датам
        const postsByDate = {};
        postsWithText.forEach((post) => {
          const dateKey = new Date(post.date).toISOString().split("T")[0];
          if (!postsByDate[dateKey]) {
            postsByDate[dateKey] = [];
          }
          postsByDate[dateKey].push({
            id: post.id,
            time: post.date,
            display: post.display,
            text: post.text,
            cleanText: post.cleanText,
            charCount: post.charCount,
            views: post.views,
            forwards: post.forwards,
            replies: post.replies,
          });
        });

        // Подсчитываем общую статистику
        const totalChars = postsWithText.reduce(
          (sum, post) => sum + post.charCount,
          0
        );
        const avgChars =
          postsWithText.length > 0
            ? Math.round(totalChars / postsWithText.length)
            : 0;

        return {
          total: allPosts.length,
          inPeriod: postsInPeriod.length,
          details: postsByDate,
          allPosts: allPosts, // Все посты без ограничений
          postsForScreenshots: postsInPeriod, // Все посты в периоде для скриншотов
          stats: {
            totalChars: totalChars,
            avgChars: avgChars,
            postsWithText: postsWithText.length,
          },
        };
      },
      startDate,
      endDate,
      channelUsername
    );

    log(`📊 Результат подсчета:`);
    log(`   Всего постов на странице: ${result.total}`);
    log(`   Постов в периоде: ${result.inPeriod}`);

    // Логируем статистику первых нескольких постов для отладки
    if (result.allPosts && result.allPosts.length > 0) {
      log(`📊 Статистика первых 3 постов:`);
      result.allPosts.slice(0, 3).forEach((post, index) => {
        log(
          `   Пост ${index + 1} (ID: ${post.id}): Просмотры=${
            post.views
          }, Пересылки=${post.forwards}, Ответы=${post.replies}`
        );
      });
    }

    if (result.inPeriod > 0) {
      log(`📅 Посты по датам:`);
      Object.keys(result.details).forEach((date) => {
        log(`   ${date}: ${result.details[date].length} постов`);
      });

      log(`📊 Статистика по символам:`);
      log(`   Всего символов: ${result.stats.totalChars}`);
      log(`   Среднее символов на пост: ${result.stats.avgChars}`);
      log(`   Постов с текстом: ${result.stats.postsWithText}`);
    }

    // Создаем скриншоты постов
    const screenshots = [];
    log(
      `🔍 Проверяем посты для скриншотов: ${
        result.postsForScreenshots ? result.postsForScreenshots.length : 0
      }`
    );

    if (result.postsForScreenshots && result.postsForScreenshots.length > 0) {
      log(
        `📸 Создаем скриншоты для ${result.postsForScreenshots.length} постов...`
      );

      for (let i = 0; i < result.postsForScreenshots.length; i++) {
        const post = result.postsForScreenshots[i];
        try {
          log(
            `📸 Создаем скриншот поста ${i + 1}/${
              result.postsForScreenshots.length
            }: ${post.id}`
          );

          // ID поста уже очищен, используем его напрямую
          const postUrl = `https://t.me/${channelUsername}/${post.id}`;
          log(`   🔗 Открываем ${postUrl}`);

          await page.goto(postUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          log(`   ⏳ Ждем загрузки поста...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Проверяем заголовок страницы
          const pageTitle = await page.title();
          log(`   📄 Заголовок страницы поста: ${pageTitle}`);

          // Проверяем текущий URL
          const currentUrl = page.url();
          log(`   🔗 Текущий URL: ${currentUrl}`);

          // Ждем загрузки поста с более гибким подходом
          try {
            await page.waitForSelector(".tgme_widget_message", {
              timeout: 10000,
            });
            log(`   ✅ Пост ${post.id} загружен (найден .tgme_widget_message)`);
          } catch (error) {
            log(
              `   ⚠️ Не найден .tgme_widget_message, проверяем другие селекторы...`
            );
            // Пробуем другие селекторы
            const alternativeSelectors = [
              ".tgme_widget_message_wrap",
              ".tgme_widget_message_text",
              ".tgme_page_widget",
              "body",
            ];

            let foundSelector = null;
            for (const selector of alternativeSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: 5000 });
                foundSelector = selector;
                log(`   ✅ Найден альтернативный селектор: ${selector}`);
                break;
              } catch (e) {
                log(`   ❌ Селектор ${selector} не найден`);
              }
            }

            if (!foundSelector) {
              throw new Error("Не удалось найти элементы поста на странице");
            }
          }

          const filename = `post_${channelUsername}_${
            post.id
          }_${Date.now()}.png`;
          const filepath = path.join(screenshotDir, filename);

          const clip = await page.evaluate(() => {
            // Ищем основной контейнер поста
            const postElement = document.querySelector(".tgme_widget_message");
            if (postElement) {
              const rect = postElement.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                console.log("Найден основной элемент поста");
                // Добавляем отступы для полного захвата поста
                const padding = 20;
                return {
                  x: Math.max(0, Math.round(rect.x - padding)),
                  y: Math.max(0, Math.round(rect.y - padding)),
                  width: Math.round(rect.width + padding * 2),
                  height: Math.round(rect.height + padding * 2),
                };
              }
            }

            // Если основной элемент не найден, ищем альтернативы
            const alternativeSelectors = [
              ".tgme_widget_message_wrap",
              ".tgme_page_widget",
              ".tgme_widget_message_text",
            ];

            for (const selector of alternativeSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  console.log(`Найден альтернативный элемент: ${selector}`);
                  // Добавляем отступы для полного захвата
                  const padding = 20;
                  return {
                    x: Math.max(0, Math.round(rect.x - padding)),
                    y: Math.max(0, Math.round(rect.y - padding)),
                    width: Math.round(rect.width + padding * 2),
                    height: Math.round(rect.height + padding * 2),
                  };
                }
              }
            }

            // Если ничего не найдено, делаем скриншот видимой области
            console.log("Не найден элемент поста, используем видимую область");
            return {
              x: 0,
              y: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            };
          });

          if (clip && clip.width > 0 && clip.height > 0) {
            await page.screenshot({
              path: filepath,
              type: "png",
              clip: clip,
            });
            log(`   📐 Область скриншота: ${clip.width}x${clip.height}px`);
          } else {
            log(
              `   ⚠️ Не удалось определить область поста, делаем скриншот страницы`
            );
            await page.screenshot({
              path: filepath,
              type: "png",
              fullPage: false,
            });
          }

          const fileStats = fs.statSync(filepath);
          log(`   💾 Скриншот сохранен: ${filename} (${fileStats.size} байт)`);

          // Извлекаем текст поста
          const postText = await page.evaluate(() => {
            // Пробуем разные селекторы для текста
            const textSelectors = [
              ".tgme_widget_message_text",
              ".tgme_widget_message_text_wrap",
              ".tgme_widget_message_text_wrap .js-message_text",
              ".tgme_widget_message .js-message_text",
            ];

            for (const selector of textSelectors) {
              const textElement = document.querySelector(selector);
              if (textElement && textElement.textContent.trim()) {
                return textElement.textContent.trim();
              }
            }
            return "";
          });

          // Извлекаем статистику
          const stats = await page.evaluate(() => {
            const viewsElement = document.querySelector(
              ".tgme_widget_message_views"
            );
            const forwardsElement = document.querySelector(
              ".tgme_widget_message_forwards"
            );
            const repliesElement = document.querySelector(
              ".tgme_widget_message_replies"
            );

            return {
              views: viewsElement ? viewsElement.textContent.trim() : "0",
              forwards: forwardsElement
                ? forwardsElement.textContent.trim()
                : "0",
              replies: repliesElement ? repliesElement.textContent.trim() : "0",
            };
          });

          screenshots.push({
            id: post.id,
            type: "post",
            file_path: filename,
            file_size: fileStats.size,
            date: post.date,
            text: postText,
            views: stats.views,
            forwards: stats.forwards,
            replies: stats.replies,
          });

          log(`   ✅ Пост ${post.id} обработан`);
        } catch (error) {
          log(`❌ Ошибка при обработке поста ${post.id}: ${error.message}`);
          const errorFilename = `error_post_${channelUsername}_${
            post.id
          }_${Date.now()}.txt`;
          const errorPath = path.join(screenshotDir, errorFilename);
          fs.writeFileSync(
            errorPath,
            `Ошибка: ${error.message}\n\nStack: ${error.stack}`
          );
          log(`   📝 Ошибка сохранена в ${errorFilename}`);

          // Добавляем информацию об ошибке в массив скриншотов
          screenshots.push({
            id: post.id,
            type: "error",
            file_path: errorFilename,
            file_size: fs.statSync(errorPath).size,
            date: post.date,
            text: `Ошибка создания скриншота: ${error.message}`,
            views: "0",
            forwards: "0",
            replies: "0",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      log(`🎉 Создано скриншотов постов: ${screenshots.length}`);
    } else {
      log(`⚠️ Нет постов для создания скриншотов`);
    }

    log(`📋 Итоговый результат:`);
    log(`   Всего постов: ${result.total}`);
    log(`   Постов в периоде: ${result.inPeriod}`);
    log(`   Скриншотов создано: ${screenshots.length}`);

    return {
      ...result,
      screenshots: screenshots,
    };
  } catch (error) {
    log(`❌ Ошибка при обработке канала: ${error.message}`);
    return {
      total: 0,
      inPeriod: 0,
      details: {},
      screenshots: [],
      error: error.message,
    };
  } finally {
    if (browser) {
      log("🔒 Закрываем браузер...");
      await browser.close();
      log("✅ Браузер закрыт");
    }
  }
}

app.listen(PORT, () => {
  log(`🚀 Simple Count Server с скриншотами запущен на порту ${PORT}`);
  log(`📱 Frontend: http://localhost:3002`);
  log(`🔧 API: http://localhost:${PORT}/api`);
  log(`🏥 Health: http://localhost:${PORT}/api/health`);
  log(``);
  log(`💡 Подсчет постов + скриншоты каждого поста`);
});
