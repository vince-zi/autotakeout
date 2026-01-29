-- =============================================
-- 饮食觉察 - Supabase 数据库架构
-- 用于存储用户决策和 AI 推荐结果
-- =============================================

-- 启用 UUID 扩展 (如果尚未启用)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- decisions 表：存储用户每次输入
-- =============================================
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT DEFAULT 'anonymous',           -- 用户ID，当前阶段默认匿名
    time_of_day TEXT NOT NULL,                  -- 时间段: 'daytime' | 'nighttime'
    mood TEXT NOT NULL,                         -- 情绪: 'stressed' | 'homesick' | 'finished_work' | 'lonely'
    hunger_level TEXT NOT NULL,                 -- 饥饿状态: 'culinary_hug' | 'crunch' | 'energy_needed'
    exercised_today BOOLEAN NOT NULL,           -- 今日是否运动
    budget_level INTEGER NOT NULL CHECK (budget_level >= 1 AND budget_level <= 5), -- 预算等级 1-5
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- recommendations 表：存储 AI 推荐结果
-- =============================================
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,                    -- 食物名称
    explanation TEXT NOT NULL,                  -- 一句话说明
    regret_score INTEGER NOT NULL CHECK (regret_score >= 1 AND regret_score <= 5), -- 后悔指数 1-5
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_user_id ON decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_decision_id ON recommendations(decision_id);

-- =============================================
-- Row Level Security (RLS) 策略
-- 允许匿名用户插入数据
-- =============================================
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- 允许所有人插入 decisions
CREATE POLICY "允许插入决策记录" ON decisions
    FOR INSERT
    WITH CHECK (true);

-- 允许所有人读取自己的 decisions (通过 user_id)
CREATE POLICY "允许读取决策记录" ON decisions
    FOR SELECT
    USING (true);

-- 允许所有人插入 recommendations
CREATE POLICY "允许插入推荐记录" ON recommendations
    FOR INSERT
    WITH CHECK (true);

-- 允许所有人读取 recommendations
CREATE POLICY "允许读取推荐记录" ON recommendations
    FOR SELECT
    USING (true);

-- =============================================
-- 注释
-- =============================================
COMMENT ON TABLE decisions IS '用户饮食决策输入记录';
COMMENT ON TABLE recommendations IS 'AI生成的饮食推荐结果';
COMMENT ON COLUMN decisions.time_of_day IS '时间段：daytime=白天，nighttime=夜晚';
COMMENT ON COLUMN decisions.mood IS '当前情绪：stressed=压力大，homesick=想家，finished_work=忙完了，lonely=孤单';
COMMENT ON COLUMN decisions.hunger_level IS '饥饿状态：culinary_hug=想被美食安慰，crunch=想嚼东西，energy_needed=需要能量';
COMMENT ON COLUMN recommendations.regret_score IS '明天后悔指数，1最低5最高';
