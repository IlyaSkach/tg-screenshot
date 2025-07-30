import React, { useState, useEffect } from "react";
import { Camera, Download, Calendar, Link, Loader2 } from "lucide-react";
import "./App.css";

// API URL - используем тот же домен для Railway
const API_BASE_URL = "";

function App() {
  const [channelUrl, setChannelUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);

  useEffect(() => {
    // Устанавливаем даты по умолчанию (последние 7 дней)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    setEndDate(today.toISOString().split("T")[0]);
    setStartDate(weekAgo.toISOString().split("T")[0]);
  }, []);

  const createReport = async () => {
    if (!channelUrl || !startDate || !endDate) {
      alert("Пожалуйста, заполните все поля");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelUrl,
          startDate,
          endDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Отчет создан! Обработка началась.");
        // Создаем временный объект отчета с базовой информацией
        const tempReport = {
          id: data.id,
          channel_username: channelUrl
            .replace("https://t.me/", "")
            .replace("@", ""),
          status: "Обрабатывается...",
          start_date: startDate,
          end_date: endDate,
        };
        setReports((prev) => [...prev, tempReport]);

        // Ждем немного и обновляем отчет
        setTimeout(async () => {
          try {
            const reportResponse = await fetch(
              `${API_BASE_URL}/api/reports/${data.id}`
            );
            const reportData = await reportResponse.json();

            if (reportData.success) {
              setReports((prev) =>
                prev.map((report) =>
                  report.id === data.id ? reportData.data : report
                )
              );
            }
          } catch (error) {
            console.error("Ошибка при обновлении отчета:", error);
          }
        }, 2000);
      } else {
        alert("Ошибка при создании отчета: " + data.error);
      }
    } catch (error) {
      alert("Ошибка при отправке запроса: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const viewReport = async (reportId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        alert("Ошибка при получении отчета: " + data.error);
      } else {
        setCurrentReport(data);
      }
    } catch (error) {
      alert("Ошибка при получении отчета: " + error.message);
    }
  };

  const downloadScreenshot = (filePath) => {
    const link = document.createElement("a");
    link.href = `${API_BASE_URL}/uploads/screenshots/${filePath}`;
    link.download = filePath.split("/").pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Текст скопирован в буфер обмена!");
    } catch (error) {
      console.error("Ошибка при копировании:", error);
      // Fallback для старых браузеров
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Текст скопирован в буфер обмена!");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Camera className="header-icon" />
          <h1>TG Post Counter</h1>
          <p>Подсчет постов в каналах Telegram</p>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* Форма создания отчета */}
          <div className="form-section">
            <h2>Создать новый отчет</h2>
            <div className="form">
              <div className="form-group">
                <label>
                  <Link className="form-icon" />
                  URL канала Telegram
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/channel_name"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <Calendar className="form-icon" />
                    Дата начала
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Calendar className="form-icon" />
                    Дата окончания
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn-primary"
                onClick={createReport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="btn-icon spinning" />
                    Создание отчета...
                  </>
                ) : (
                  <>
                    <Camera className="btn-icon" />
                    Создать отчет
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Список отчетов */}
          <div className="reports-section">
            <h2>Мои отчеты</h2>
            {reports.length === 0 ? (
              <div className="empty-state">
                <Camera className="empty-icon" />
                <p>У вас пока нет отчетов</p>
                <p>Создайте первый отчет выше</p>
              </div>
            ) : (
              <div className="reports-list">
                {reports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-info">
                      <h3>{report.channel_username || "Канал"}</h3>
                      <p>
                        Период: {report.start_date} - {report.end_date}
                      </p>
                      <p>
                        Постов: {report.posts_in_period || "Обрабатывается..."}
                      </p>
                      <p>ID: {report.id}</p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => viewReport(report.id)}
                    >
                      Просмотреть
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Детали отчета */}
          {currentReport && (
            <div className="report-details">
              <h2>Детали отчета #{currentReport.id}</h2>
              <div className="report-info-grid">
                <div>
                  <strong>Канал:</strong> {currentReport.channel_username}
                </div>
                <div>
                  <strong>Период:</strong> {currentReport.start_date} -{" "}
                  {currentReport.end_date}
                </div>
                <div>
                  <strong>Всего постов:</strong> {currentReport.total_posts}
                </div>
                <div>
                  <strong>Постов в периоде:</strong>{" "}
                  {currentReport.posts_in_period}
                </div>
                <div>
                  <strong>Всего символов:</strong>{" "}
                  {currentReport.stats?.totalChars || 0}
                </div>
                <div>
                  <strong>Среднее символов на пост:</strong>{" "}
                  {currentReport.stats?.avgChars || 0}
                </div>
              </div>

              {currentReport.posts_details &&
                Object.keys(currentReport.posts_details).length > 0 && (
                  <div className="posts-grid">
                    <h3>Посты по датам</h3>
                    {Object.keys(currentReport.posts_details).map((date) => (
                      <div key={date} className="date-section">
                        <h4>
                          Дата: {date} (
                          {currentReport.posts_details[date].length} постов)
                        </h4>
                        <div className="posts-list">
                          {currentReport.posts_details[date].map((post) => {
                            // Находим соответствующий скриншот для этого поста
                            const screenshot = currentReport.screenshots?.find(
                              (s) => s.id === post.id
                            );

                            return (
                              <div key={post.id} className="post-item">
                                <div className="post-header">
                                  <div className="post-meta">
                                    <p>
                                      <strong>ID:</strong> {post.id}
                                    </p>
                                    <p>
                                      <strong>Время:</strong> {post.display}
                                    </p>
                                    <p>
                                      <strong>Символов:</strong>{" "}
                                      {post.charCount || 0}
                                    </p>
                                    {/* Статистика поста */}
                                    <p>
                                      <strong>Просмотры:</strong>{" "}
                                      {post.views || "0"}
                                    </p>
                                    <p>
                                      <strong>Пересылки:</strong>{" "}
                                      {post.forwards || "0"}
                                    </p>
                                    <p>
                                      <strong>Ответы:</strong>{" "}
                                      {post.replies || "0"}
                                    </p>
                                  </div>
                                </div>

                                <div className="post-content">
                                  {/* Скриншот */}
                                  {screenshot && (
                                    <div className="post-screenshot">
                                      {screenshot.type === "error" ? (
                                        <div className="error-screenshot">
                                          <p>❌ Ошибка создания скриншота</p>
                                          <p>{screenshot.text}</p>
                                        </div>
                                      ) : (
                                        <div className="screenshot-container">
                                          <img
                                            src={`${API_BASE_URL}/uploads/${screenshot.file_path}`}
                                            alt={`Скриншот поста ${screenshot.id}`}
                                            className="post-screenshot-image"
                                            onError={(e) => {
                                              e.target.style.display = "none";
                                              e.target.nextSibling.style.display =
                                                "block";
                                            }}
                                          />
                                          <div
                                            className="image-error"
                                            style={{ display: "none" }}
                                          >
                                            <p>❌ Изображение не загружено</p>
                                            <p>Файл: {screenshot.file_path}</p>
                                          </div>
                                          <button
                                            className="btn-download"
                                            onClick={() =>
                                              downloadScreenshot(
                                                screenshot.file_path
                                              )
                                            }
                                          >
                                            <Download size={16} />
                                            Скачать скриншот
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Текст поста */}
                                  {post.text && (
                                    <div className="post-text">
                                      <h5>Текст поста:</h5>
                                      <div className="text-content">
                                        {post.text}
                                      </div>
                                      {post.cleanText &&
                                        post.cleanText !== post.text && (
                                          <div className="clean-text">
                                            <h5>
                                              Очищенный текст ({post.charCount}{" "}
                                              символов):
                                            </h5>
                                            <div className="text-content">
                                              {post.cleanText}
                                            </div>
                                            <button
                                              className="btn-copy"
                                              onClick={() =>
                                                copyToClipboard(post.cleanText)
                                              }
                                              title="Копировать очищенный текст"
                                            >
                                              📋 Копировать текст
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  )}

                                  {/* Текст из скриншота (если отличается) */}
                                  {screenshot &&
                                    screenshot.text &&
                                    screenshot.text !== post.text && (
                                      <div className="screenshot-text">
                                        <h5>Текст из скриншота:</h5>
                                        <div className="text-content">
                                          {screenshot.text}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Убираем отдельную секцию скриншотов, так как теперь они в постах */}
              <button
                className="btn-secondary"
                onClick={() => setCurrentReport(null)}
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
