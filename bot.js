// Подключаем библиотеки
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { saveUserState, getUserState } = require('./state');
const { processInvoice, searchDashboard, clearDashboard } = require('./n8n');

// Получаем токен из .env
const token = process.env.TELEGRAM_BOT_TOKEN;

// Создаём бота
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот SuShef запущен!');

// ============================================
// КОМАНДА: /start
// ============================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`👤 Пользователь ${chatId} запустил бота`);
  
  // Сбрасываем состояние
  await saveUserState(chatId, 'idle');
  
  bot.sendMessage(chatId, 'Привет! 👋\n\nЯ помогу вести учёт накладных.\n\nВыбери команду:\n/supply - добавить накладную\n/dashboard - найти данные');
});

// ============================================
// КОМАНДА: /supply (режим приёма накладных)
// ============================================
bot.onText(/\/supply/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`📦 Пользователь ${chatId} → режим SUPPLY`);
  
  // Устанавливаем состояние
  await saveUserState(chatId, 'supply');
  
  const text = `📸 Можно отправить:

• Фото накладной (чем лучше качество, тем лучше результат)
• PDF файл
• Обычный текст

В таблицу записывается:
Имя поставщика, дата прихода, товар, цена за единицу, вес товара.

Можно прописывать простым языком.`;

  bot.sendMessage(chatId, text);
});

// ============================================
// КОМАНДА: /dashboard (режим поиска)
// ============================================
bot.onText(/\/dashboard/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`📊 Пользователь ${chatId} → режим DASHBOARD`);
  
  // Устанавливаем состояние
  await saveUserState(chatId, 'dashboard');
  
  const text = `📋 Примеры запросов:

🗓 По дате:
"Дай все за 27 января"
"Покажи вчера"

🏢 По поставщику:
"Все от ТОО Океан"

📦 По продукту:
"Креветки"

🔄 Комбинации:
"Креветки от Океан за 27 января"`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Очистить таблицу', callback_data: 'delete_table' }]
      ]
    }
  };
  
  bot.sendMessage(chatId, text, options);
});

// ============================================
// ОБРАБОТКА CALLBACK КНОПОК
// ============================================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  console.log(`🔘 Нажата кнопка: ${data}`);
  
  if (data === 'delete_table') {
    // Вызываем n8n для очистки Google Sheets
    const result = await clearDashboard(chatId);
    
    if (result.success) {
      bot.sendMessage(chatId, '🗑 Таблица очищена');
    } else {
      bot.sendMessage(chatId, '❌ Ошибка очистки таблицы');
    }
    
  } else if (data === 'comand_null') {
    // Сброс команды
    await saveUserState(chatId, 'idle');
    bot.sendMessage(chatId, 'Команда сброшена. Выберите новую команду.');
  }
  
  // Убираем "часики" на кнопке
  bot.answerCallbackQuery(query.id);
});

// ============================================
// ОБРАБОТКА ФОТО
// ============================================
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const state = await getUserState(chatId);
  
  console.log(`📷 Фото от ${chatId}, состояние: ${state}`);
  
  if (state === 'supply') {
    // Получаем file_id самого большого фото
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    
    bot.sendMessage(chatId, '⏳ Обрабатываю накладную...');
    
    // Отправляем в n8n для обработки
    const result = await processInvoice({
      type: 'photo',
      fileId: fileId,
      chatId: chatId,
      text: null
    });
    
    if (result.success) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Сбросить команду', callback_data: 'comand_null' }]
          ]
        }
      };
      bot.sendMessage(chatId, '✅ Товар добавлен!', options);
    } else {
      bot.sendMessage(chatId, '❌ Ошибка обработки. Попробуй ещё раз.');
    }
    
  } else {
    bot.sendMessage(chatId, `⚠️ Вы находитесь в режиме "${state}".\n\nДля загрузки накладных введи /supply`);
  }
});

// ============================================
// ОБРАБОТКА ДОКУМЕНТОВ (PDF)
// ============================================
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const state = await getUserState(chatId);
  
  console.log(`📄 Документ от ${chatId}, состояние: ${state}`);
  
  if (state === 'supply') {
    const fileId = msg.document.file_id;
    const mimeType = msg.document.mime_type;
    
    // Проверка: если это изображение как файл
    if (mimeType === 'image/jpeg') {
      bot.sendMessage(chatId, '📸 Изображение отправлено как файл. Нажми кнопку "Сжать фотографию" перед отправкой.');
      return;
    }
    
    bot.sendMessage(chatId, '⏳ Обрабатываю PDF...');
    
    // Отправляем в n8n для обработки
    const result = await processInvoice({
      type: 'pdf',
      fileId: fileId,
      chatId: chatId,
      text: null
    });
    
    if (result.success) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Сбросить команду', callback_data: 'comand_null' }]
          ]
        }
      };
      bot.sendMessage(chatId, '✅ Товар добавлен!', options);
    } else {
      bot.sendMessage(chatId, '❌ Ошибка обработки. Попробуй ещё раз.');
    }
    
  } else {
    bot.sendMessage(chatId, `⚠️ Вы находитесь в режиме "${state}".\n\nДля загрузки накладных введи /supply`);
  }
});

// ============================================
// ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ
// ============================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Пропускаем команды (они обрабатываются отдельно)
  if (text && text.startsWith('/')) {
    return;
  }
  
  // Пропускаем если нет текста (фото, документы обрабатываются отдельно)
  if (!text) {
    return;
  }
  
  const state = await getUserState(chatId);
  console.log(`💬 Текст от ${chatId}: "${text}", состояние: ${state}`);
  
  if (state === 'supply') {
    // Текстовый ввод накладной
    bot.sendMessage(chatId, '⏳ Обрабатываю данные...');
    
    // Отправляем в n8n для обработки
    const result = await processInvoice({
      type: 'text',
      fileId: null,
      chatId: chatId,
      text: text
    });
    
    if (result.success) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Сбросить команду', callback_data: 'comand_null' }]
          ]
        }
      };
      bot.sendMessage(chatId, '✅ Товар добавлен!', options);
    } else {
      bot.sendMessage(chatId, '❌ Ошибка обработки. Попробуй ещё раз.');
    }
    
  } else if (state === 'dashboard') {
    // Поисковый запрос для Dashboard
    bot.sendMessage(chatId, '⏳ Ищу данные...');
    
    // Отправляем в n8n для поиска
    const result = await searchDashboard(text, chatId);
    
    if (result.success) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Очистить таблицу', callback_data: 'delete_table' }]
          ]
        }
      };
      const dashboardUrl = 'https://docs.google.com/spreadsheets/d/1Sj22AJnBWJUkGG7qrP5qsb9Pg99hxYAwzkmSd7nP_3E/edit?gid=197248813#gid=197248813';
      bot.sendMessage(chatId, `✅ Dashboard готов\n\nСсылка: ${dashboardUrl}`, options);
    } else {
      bot.sendMessage(chatId, '❌ Ошибка поиска. Попробуй ещё раз.');
    }
    
  } else {
    // Пользователь не выбрал команду
    bot.sendMessage(chatId, 'Выберите команду в меню:\n\n/supply - добавить накладную\n/dashboard - найти данные');
  }
});

// ============================================
// ОБРАБОТКА ОШИБОК
// ============================================
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});