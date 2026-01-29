-- =============================================
-- 饮食觉察 - 数据库扩展迁移
-- 添加商家信息、平台跳转、用户反馈等字段
-- =============================================

-- 扩展 recommendations 表
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS restaurant TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS jump_keyword TEXT,
ADD COLUMN IF NOT EXISTS user_clicked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS user_rated INT;

-- 为 decisions 表添加匿名用户追踪
ALTER TABLE decisions
ADD COLUMN IF NOT EXISTS user_token TEXT;

-- 创建用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    decision_id UUID REFERENCES decisions(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL, -- 'clicked', 'rated', 'skipped'
    rating INT, -- 1-5 星评分
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建吃后复盘表
CREATE TABLE IF NOT EXISTS meal_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_token TEXT NOT NULL,
    food_name TEXT NOT NULL,
    fullness INT DEFAULT 3, -- 1=太撑 2=刚好 3=一般 4=没吃饱 5=还饿
    mood TEXT DEFAULT 'neutral', -- happy, satisfied, neutral, guilty, regret
    regret_score INT DEFAULT 3, -- 1-5
    price DECIMAL(10, 2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON user_feedback
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous reads" ON user_feedback
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow anonymous inserts on meal_reviews" ON meal_reviews
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous reads on meal_reviews" ON meal_reviews
    FOR SELECT
    TO anon
    USING (true);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_decisions_user_token ON decisions(user_token);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendations_platform ON recommendations(platform);
CREATE INDEX IF NOT EXISTS idx_user_feedback_decision ON user_feedback(decision_id);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_user_token ON meal_reviews(user_token);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_created_at ON meal_reviews(created_at);
