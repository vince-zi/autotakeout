/**
 * 饮食觉察 - 前端交互逻辑
 * 处理表单提交、API调用和页面跳转
 */

// Supabase 配置
const SUPABASE_URL = 'https://lqqdhlxcfmdgxdayxxsi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxcWRobHhjZm1kZ3hkYXl4eHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTQzNzAsImV4cCI6MjA4NTI3MDM3MH0.TkFKzi_UgHjvzgK1zH4thEjQ3fuuotAPwjfkwptdvqU';

// Edge Function URL
const RECOMMEND_API = `${SUPABASE_URL}/functions/v1/recommend`;

/**
 * 收集表单数据
 */
function collectFormData() {
    const form = document.querySelector('form');
    if (!form) return null;

    // 获取时间段
    const timeOfDay = form.querySelector('input[name="time_of_day"]:checked')?.value || 'nighttime';

    // 获取情绪
    const mood = form.querySelector('input[name="mood"]:checked')?.value || 'stressed';

    // 获取饥饿状态
    const hungerLevel = form.querySelector('input[name="hunger_level"]:checked')?.value || 'culinary_hug';

    // 获取运动状态
    const exercise = form.querySelector('input[name="exercise"]:checked')?.value || 'no';
    const exercisedToday = exercise === 'yes';

    // 获取预算等级
    const budgetRange = form.querySelector('input[type="range"]');
    const budgetLevel = budgetRange ? parseInt(budgetRange.value) : 3;

    return {
        time_of_day: timeOfDay,
        mood: mood,
        hunger_level: hungerLevel,
        exercised_today: exercisedToday,
        budget_level: budgetLevel
    };
}

/**
 * 调用推荐 API
 */
async function getRecommendations(formData) {
    try {
        const response = await fetch(RECOMMEND_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

/**
 * 显示加载状态
 */
function showLoading(button) {
    if (!button) return;

    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = `
        <span class="inline-flex items-center gap-2">
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            正在为你寻找慰藉...
        </span>
    `;
}

/**
 * 隐藏加载状态
 */
function hideLoading(button) {
    if (!button || !button.dataset.originalContent) return;

    button.disabled = false;
    button.innerHTML = button.dataset.originalContent;
}

/**
 * 显示错误提示
 */
function showError(message) {
    // 创建 toast 提示
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3';
    toast.innerHTML = `
        <span class="material-symbols-outlined text-red-500">error</span>
        <span class="flex-1 text-sm font-medium">${message}</span>
    `;

    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 处理表单提交
 */
async function handleSubmit(event) {
    event.preventDefault();

    const submitButton = document.querySelector('button[type="button"]');

    // 收集表单数据
    const formData = collectFormData();
    if (!formData) {
        showError('请完成所有选项');
        return;
    }

    console.log('提交数据:', formData);

    // 显示加载状态
    showLoading(submitButton);

    try {
        // 调用 API 获取推荐
        const result = await getRecommendations(formData);

        // 存储结果到 sessionStorage
        sessionStorage.setItem('recommendations', JSON.stringify(result));

        // 跳转到结果页
        window.location.href = 'result.html';

    } catch (error) {
        hideLoading(submitButton);
        showError(error.message || '获取推荐失败，请稍后再试');
    }
}

/**
 * 初始化
 */
function init() {
    // 绑定提交按钮事件
    const submitButton = document.querySelector('button[type="button"]');
    if (submitButton) {
        submitButton.addEventListener('click', handleSubmit);
    }

    // 添加键盘快捷键支持（Enter 提交）
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            submitButton?.click();
        }
    });
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
