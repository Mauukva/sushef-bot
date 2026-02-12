// n8n.js - интеграция с n8n workflow
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// URL webhook из n8n
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://primary-production-ff51e.up.railway.app/webhook/f30c923c-c5f3-4bf4-955d-890080196241';

// Telegram bot для скачивания файлов
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Скачать файл из Telegram и конвертировать в base64
 * @param {string} fileId - Telegram file_id
 * @returns {Promise<string>} Base64 encoded file
 */
async function downloadFile(fileId) {
  try {
    console.log(`📥 Скачивание файла: ${fileId}`);
    
    // Получаем путь к файлу
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    console.log(`📡 Загрузка с: ${file.file_path}`);
    
    // Скачиваем файл как binary
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    });
    
    // Конвертируем в base64
    const base64 = Buffer.from(response.data).toString('base64');
    
    console.log(`✅ Файл скачан: ${(base64.length / 1024).toFixed(2)} KB`);
    
    return base64;
    
  } catch (error) {
    console.error('❌ Ошибка скачивания файла:', error.message);
    throw error;
  }
}

/**
 * Обработать накладную через n8n
 * @param {object} data - Данные для обработки
 * @param {string} data.type - Тип данных: 'photo', 'pdf', 'text'
 * @param {string} data.fileId - File ID (для photo/pdf) или null
 * @param {string} data.text - Текст (для text) или null
 * @param {number} data.chatId - Telegram chat ID
 * @returns {Promise<object>} Результат обработки
 */
async function processInvoice(data) {
  try {
    console.log(`📤 Обработка: type=${data.type}, chatId=${data.chatId}`);
    
    let payload = {};
    
    if (data.type === 'photo') {
      // Скачиваем фото
      const base64 = await downloadFile(data.fileId);
      
      payload = {
        type: 'photo',
        chatId: data.chatId,
        file: {
          data: base64,
          mimeType: 'image/jpeg'
        }
      };
      
    } else if (data.type === 'pdf') {
      // Скачиваем PDF
      const base64 = await downloadFile(data.fileId);
      
      payload = {
        type: 'pdf',
        chatId: data.chatId,
        file: {
          data: base64,
          mimeType: 'application/pdf'
        }
      };
      
    } else if (data.type === 'text') {
      // Текст отправляем как есть
      payload = {
        type: 'text',
        chatId: data.chatId,
        text: data.text
      };
    }
    
    console.log(`📡 Отправка в n8n...`);
    
    // Отправляем POST запрос
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000  // 120 секунд (обработка может занять время)
    });
    
    console.log(`✅ n8n ответил: ${response.status}`);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ Ошибка при вызове n8n:', error.message);
    
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Поиск в Dashboard через n8n
 * @param {string} query - Поисковый запрос
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<object>} Результат поиска
 */
async function searchDashboard(query, chatId) {
  try {
    console.log(`📤 Поиск в Dashboard: "${query}", chatId=${chatId}`);
    
    const payload = {
      type: 'dashboard',
      chatId: chatId,
      text: query
    };
    
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    console.log(`✅ Dashboard готов: ${response.status}`);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ Ошибка поиска Dashboard:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Очистить таблицу Dashboard через n8n
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<object>} Результат
 */
async function clearDashboard(chatId) {
  try {
    console.log(`📤 Очистка Dashboard, chatId=${chatId}`);
    
    const payload = {
      type: 'clear_dashboard',
      chatId: chatId
    };
    
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log(`✅ Dashboard очищен: ${response.status}`);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ Ошибка очистки Dashboard:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processInvoice,
  searchDashboard,
  clearDashboard
};