// state.js - управление состояниями пользователей
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Сохранить состояние пользователя
 * @param {number} userId - Telegram user ID
 * @param {string} state - Состояние: 'idle', 'supply', 'dashboard'
 * @param {object} context - Дополнительные данные (опционально)
 */
async function saveUserState(userId, state, context = {}) {
  try {
    const { data, error } = await supabase
      .from('user_states')
      .upsert({
        user_id: userId,
        current_state: state,
        context: context,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('❌ Ошибка сохранения состояния:', error);
      return null;
    }
    
    console.log(`💾 Состояние сохранено: user ${userId} → ${state}`);
    return { data, error: null };
    
  } catch (err) {
    console.error('❌ Исключение в saveUserState:', err);
    return null;
  }
}

/**
 * Получить состояние пользователя
 * @param {number} userId - Telegram user ID
 * @returns {string} Текущее состояние или 'idle'
 */
async function getUserState(userId) {
  try {
    const { data, error } = await supabase
      .from('user_states')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      console.log(`ℹ️ Состояние не найдено для user ${userId}, возвращаю 'idle'`);
      return 'idle';
    }
    
    console.log(`📖 Состояние прочитано: user ${userId} → ${data.current_state}`);
    return data.current_state;
    
  } catch (err) {
    console.error('❌ Исключение в getUserState:', err);
    return 'idle';
  }
}

/**
 * Получить полную информацию о состоянии пользователя
 * @param {number} userId - Telegram user ID
 * @returns {object|null} Объект с полными данными или null
 */
async function getUserStateData(userId) {
  try {
    const { data, error } = await supabase
      .from('user_states')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data;
    
  } catch (err) {
    console.error('❌ Исключение в getUserStateData:', err);
    return null;
  }
}

module.exports = {
  saveUserState,
  getUserState,
  getUserStateData
};