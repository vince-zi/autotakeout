// 饮食觉察 - 推荐 Edge Function
// 处理用户输入，调用火山方舟AI，返回饮食建议

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS 头
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// DeepSeek API 配置
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL_ID = "deepseek-chat";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "sk-b704577eff8a472e9b715b0a1007aa9e";

// 输入字段的中文映射
const TIME_MAP: Record<string, string> = {
    daytime: "白天",
    nighttime: "夜晚/深夜",
};

const MOOD_MAP: Record<string, string> = {
    stressed: "压力很大，需要释放",
    homesick: "有点想家，渴望温暖",
    finished_work: "终于忙完了，想奖励自己",
    lonely: "感觉有些孤单，需要陪伴",
};

const HUNGER_MAP: Record<string, string> = {
    culinary_hug: "想被美食安慰一下",
    crunch: "单纯想嚼点什么",
    energy_needed: "急需能量补给",
};

const BUDGET_MAP: Record<number, string> = {
    1: "尽量省钱",
    2: "经济实惠",
    3: "正常消费",
    4: "稍微奢侈一下",
    5: "今天不在乎价格",
};

// 构建 AI Prompt
function buildPrompt(input: {
    time_of_day: string;
    mood: string;
    hunger_level: string;
    exercised_today: boolean;
    budget_level: number;
}): string {
    const timeDesc = TIME_MAP[input.time_of_day] || "未知时间";
    const moodDesc = MOOD_MAP[input.mood] || "一般";
    const hungerDesc = HUNGER_MAP[input.hunger_level] || "有点饿";
    const exerciseDesc = input.exercised_today ? "今天运动过" : "今天没运动";
    const budgetDesc = BUDGET_MAP[input.budget_level] || "正常消费";

    // 获取当前北京时间
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const hour = beijingTime.getUTCHours();
    const minute = beijingTime.getUTCMinutes();
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    return `你是一个专业的深夜美食决策顾问，面向中国一二线城市18-35岁用户。

【当前时间】${timeStr}
【用户状态】
- 时间场景：${timeDesc}
- 情绪状态：${moodDesc}  
- 身体感觉：${hungerDesc}
- 运动情况：${exerciseDesc}
- 预算偏好：${budgetDesc}

【你必须严格按以下步骤分析，不可跳过】

Step 1｜判断用户状态
- 这是夜宵场景还是下午茶/加班场景
- 用户的负罪敏感度：怕胖？怕花钱？怕浪费？

Step 2｜模拟平台搜索
- 模拟搜索美团外卖、淘宝闪送、京东外卖、便利店等平台
- 关键词：夜宵、便利店、卤味、低脂、深夜营业

Step 3｜筛选规则（每个推荐必须同时满足至少3条）
✅ 当前时间仍在营业
✅ 有平台补贴/满减/配送费低
✅ 单人份、价格不高（避免"买多吃多"）
✅ 次日负罪感低（油脂/热量/心理层面）

Step 4｜输出格式

必须严格返回以下JSON格式，不要有任何其他文字：
{
  "current_time": "${timeStr}",
  "scene": "夜宵场景/下午茶/加班",
  "guilt_level": "轻度负罪感/中度负罪感/无负罪感",
  "recommendations": [
    {
      "food_name": "具体食物名称（如便利店煮玉米）",
      "platform": "meituan 或 taobao 或 jd",
      "search_keyword": "搜索关键词（如：煮玉米、卤味）",
      "source": "来源描述（如：美团外卖、淘宝闪送、京东秒送）",
      "price": "价格（如¥4.9）",
      "discount": "优惠信息（如满15-8、免配送费）",
      "delivery_fee": "配送费（如¥0）",
      "reason": "推荐原因（从价格/份量/健康角度）",
      "regret_score": 1-5的整数,
      "regret_reason": "后悔指数的逻辑原因"
    }
  ],
  "alternatives": [
    {
      "food_name": "替代选项名称",
      "platform": "meituan 或 taobao 或 jd",
      "search_keyword": "搜索关键词",
      "source": "来源平台"
    }
  ],
  "not_recommended": [
    {
      "food_name": "不推荐的食物",
      "reason": "为什么不推荐"
    }
  ]
}

【重要】
- platform 字段只能是：meituan / taobao / jd 三选一
- search_keyword 是用于在对应平台搜索的关键词
- 食物必须是中国常见的、真实可点的
- 价格要合理真实（便利店食品5-15元，外卖15-30元）
- recommendations 给2-3个
- alternatives 给1-2个
- not_recommended 给1-2个
- 后悔指数要有逻辑依据`
}

// 调用 DeepSeek API
async function callDeepSeekAI(prompt: string): Promise<any> {
    const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL_ID,
            messages: [
                {
                    role: "system",
                    content: "你是一个专业的深夜美食决策顾问，面向中国一二线城市用户。根据用户的状态推荐真实可点的外卖或便利店食物。必须严格返回JSON格式。"
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 2000,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("火山方舟 API 错误:", errorText);
        throw new Error(`AI API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("AI 返回内容为空");
    }

    // 尝试解析 JSON
    try {
        // 处理可能的 markdown 代码块
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.slice(7);
        }
        if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith("```")) {
            jsonStr = jsonStr.slice(0, -3);
        }
        jsonStr = jsonStr.trim();

        const result = JSON.parse(jsonStr);

        // 验证格式
        if (!result.recommendations || !Array.isArray(result.recommendations)) {
            throw new Error("AI 返回格式不正确");
        }

        return result;
    } catch (e) {
        console.error("JSON 解析失败:", content);
        throw new Error("AI 返回内容无法解析");
    }
}

// 主处理函数
serve(async (req: Request) => {
    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 获取请求数据
        const input = await req.json();

        // 验证必要字段
        const requiredFields = ["time_of_day", "mood", "hunger_level", "exercised_today", "budget_level"];
        for (const field of requiredFields) {
            if (input[field] === undefined) {
                throw new Error(`缺少必要字段: ${field}`);
            }
        }

        // 初始化 Supabase 客户端
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 存储用户决策
        const { data: decision, error: decisionError } = await supabase
            .from("decisions")
            .insert({
                time_of_day: input.time_of_day,
                mood: input.mood,
                hunger_level: input.hunger_level,
                exercised_today: input.exercised_today,
                budget_level: input.budget_level,
            })
            .select()
            .single();

        if (decisionError) {
            console.error("存储决策失败:", decisionError);
            throw new Error("数据存储失败");
        }

        // 构建 prompt 并调用 AI
        const prompt = buildPrompt(input);
        const aiResult = await callDeepSeekAI(prompt);

        // 存储推荐结果
        const recommendationsToInsert = aiResult.recommendations.map((rec) => ({
            decision_id: decision.id,
            food_name: rec.food_name,
            explanation: rec.explanation,
            regret_score: rec.regret_score,
        }));

        const { error: recError } = await supabase
            .from("recommendations")
            .insert(recommendationsToInsert);

        if (recError) {
            console.error("存储推荐失败:", recError);
            // 不抛出错误，继续返回结果
        }

        // 返回推荐结果
        return new Response(
            JSON.stringify({
                decision_id: decision.id,
                recommendations: aiResult.recommendations,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error) {
        console.error("处理错误:", error);
        return new Response(
            JSON.stringify({ error: error.message || "服务器内部错误" }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
