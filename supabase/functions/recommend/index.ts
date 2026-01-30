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

// 心情 -> 推荐食物类型映射（核心逻辑）
const MOOD_FOOD_MAP: Record<string, { foods: string[]; style: string; reason: string }> = {
    stressed: {
        foods: ["麻辣烫", "火锅", "烧烤", "炸鸡", "麻辣香锅", "小龙虾", "辣子鸡"],
        style: "重口味、辣的、解压型",
        reason: "辣味能刺激多巴胺分泌，帮助释放压力"
    },
    homesick: {
        foods: ["饺子", "馄饨", "面条", "砂锅", "粥", "红烧肉", "排骨汤", "米饭套餐"],
        style: "家常菜、温暖的、妈妈的味道",
        reason: "温热的家常味道能带来安慰和归属感"
    },
    finished_work: {
        foods: ["寿司", "日料", "牛排", "披萨", "奶茶", "甜品", "蛋糕", "精致套餐"],
        style: "品质稍高、享受型、犒劳自己",
        reason: "忙碌后值得用美食奖励自己"
    },
    lonely: {
        foods: ["关东煮", "便利店饭团", "一人食套餐", "拉面", "盖浇饭", "咖喱饭"],
        style: "单人份、治愈系、暖心",
        reason: "一人份的温暖食物，陪伴孤独时刻"
    }
};

// 饥饿状态 -> 推荐食物类型映射
const HUNGER_FOOD_MAP: Record<string, { foods: string[]; portion: string }> = {
    culinary_hug: {
        foods: ["甜品", "奶茶", "小食", "点心", "面包"],
        portion: "小份，不求饱只求暖心"
    },
    crunch: {
        foods: ["薯片", "坚果", "鸡米花", "炸物", "锅巴"],
        portion: "零食型，嘎嘣脆的口感"
    },
    energy_needed: {
        foods: ["大份套餐", "米饭", "面条", "盖浇饭", "快餐"],
        portion: "份量足，快速补充能量"
    }
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

// 价格知识库：每个预算档位对应的价格区间（元）
const PRICE_RANGES: Record<number, { min: number; max: number; keywords: string }> = {
    1: { min: 5, max: 15, keywords: "优惠套餐 特价 折扣 小份" },      // 尽量省钱
    2: { min: 15, max: 25, keywords: "套餐 单人餐 经济" },           // 经济实惠
    3: { min: 25, max: 40, keywords: "招牌 热销" },                  // 正常消费
    4: { min: 40, max: 80, keywords: "品质 甄选 双人餐" },           // 稍微奢侈
    5: { min: 80, max: 200, keywords: "大餐 豪华 精选 多人餐" },     // 不在乎价格
};

// 平台价格系数（不同平台价格略有差异）
const PLATFORM_PRICE_FACTOR: Record<string, number> = {
    meituan: 1.0,
    eleme: 1.0,
    jd: 1.1,  // 京东秒送略贵
};

// 构建 AI Prompt（增强版：定位、时间感知、5个推荐、排除已推荐食品）
function buildPrompt(input: {
    time_of_day: string;
    mood: string;
    hunger_level: string;
    exercised_today: boolean;
    budget_level: number;
    location?: { latitude: number; longitude: number } | null;
    is_daytime?: boolean;
    time_context?: { period: string; label: string; isNight: boolean };
    excluded_foods?: string[];  // 排除列表：推荐过但没下单的食品
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

    // 判断是否白天
    const isDaytime = input.is_daytime !== undefined ? input.is_daytime : (hour >= 6 && hour < 18);

    // 场景描述（白天不要提"夜宵"）
    let sceneLabel = input.time_context?.label || timeDesc;
    if (isDaytime && sceneLabel.includes('夜')) {
        sceneLabel = hour < 11 ? '早餐' : hour < 14 ? '午餐' : hour < 17 ? '下午茶' : '晚餐';
    }

    // 位置信息
    const locationInfo = input.location
        ? `用户位置：纬度${input.location.latitude.toFixed(4)}，经度${input.location.longitude.toFixed(4)}（请优先推荐附近商家）`
        : '用户位置：未知（推荐全国连锁或常见商家）';

    // 获取心情对应的食物推荐
    const moodFood = MOOD_FOOD_MAP[input.mood] || MOOD_FOOD_MAP.stressed;
    const hungerFood = HUNGER_FOOD_MAP[input.hunger_level] || HUNGER_FOOD_MAP.culinary_hug;

    const userInput = {
        current_time: timeStr,
        scene: sceneLabel,
        mood: moodDesc,
        mood_foods: moodFood.foods.join('、'),
        hunger: hungerDesc,
        hunger_portion: hungerFood.portion,
        exercise: exerciseDesc,
        budget: budgetDesc,
        is_daytime: isDaytime
    };

    // 获取价格区间
    const priceRange = PRICE_RANGES[input.budget_level] || PRICE_RANGES[3];
    const priceConstraint = `价格必须在 ${priceRange.min}-${priceRange.max} 元之间`;

    return `你是一个外卖推荐专家，帮助用户快速做出饮食决策。

【当前时间】${timeStr}（${isDaytime ? '白天' : '夜间'}）
【用户位置】${locationInfo}
【用户状态】
${JSON.stringify(userInput, null, 2)}

【⚠️ 心情驱动的推荐（重要！）】
用户心情：${moodDesc}
推荐食物风格：${moodFood.style}
推荐理由：${moodFood.reason}
⭐ 优先推荐这些食物：${moodFood.foods.join('、')}

【饥饿状态】
${hungerDesc}
份量偏好：${hungerFood.portion}
适合的食物类型：${hungerFood.foods.join('、')}

【预算约束】⚠️ ${priceConstraint}
用户选择了"${budgetDesc}"档位，推荐的菜品单价必须在 ${priceRange.min}-${priceRange.max} 元范围内。
搜索时可附加关键词：${priceRange.keywords}

【核心任务】
根据用户的心情和饥饿状态，推荐5个真实可点的外卖或便利店商品。

【输出要求】
必须严格返回以下JSON格式，不要有任何其他文字：

{
  "scene": "${sceneLabel}",
  "budget_level": ${input.budget_level},
  "price_range": "${priceRange.min}-${priceRange.max}元",
  "recommendations": [
    {
      "food_name": "具体菜品名称（如：香辣鸡腿堡套餐）",
      "restaurant": "商家名称（如：肯德基 中关村店）",
      "platform": "meituan",
      "estimated_price": ${Math.round((priceRange.min + priceRange.max) / 2)},
      "reason": "推荐理由，不超过15字",
      "jump_keyword": "肯德基 香辣鸡腿堡 ${priceRange.keywords.split(' ')[0]}",
      "regret_score": 2,
      "regret_reason": "份量适中，快餐标准化"
    }
  ],
  "alternatives": [
    {
      "food_name": "备选菜品",
      "restaurant": "备选商家",
      "platform": "eleme",
      "estimated_price": ${priceRange.min},
      "jump_keyword": "搜索关键词"
    }
  ]
}

【关键规则】
1. ⚠️ 必须推荐当前时间（${timeStr}）正在营业的商家
2. ⚠️ 价格必须严格在 ${priceRange.min}-${priceRange.max} 元之间
3. ⚠️ 优先推荐24小时营业或营业到凌晨的商家
4. ⚠️ 推荐附近连锁店（肯德基、麦当劳、便利蜂、全家、永和大王、沙县小吃等）
5. platform 必须是 "meituan"、"eleme" 或 "jd"（京东秒送）
6. jump_keyword 格式："商家名 菜品名"，可附加：${priceRange.keywords}
7. recommendations 必须给5个
8. alternatives 给2个备选
9. ${isDaytime ? '白天场景，不要提及"夜宵"或"深夜"等字眼' : '可以使用夜宵相关描述'}
10. 只返回JSON，禁止任何解释文字
11. ⚠️ 【重要】以下食品用户已经看过但没下单，禁止推荐：${input.excluded_foods?.length ? input.excluded_foods.join('、') : '无'}`
}

// 校准推荐结果：确保价格在合理范围内
interface Recommendation {
    food_name: string;
    restaurant: string;
    platform: string;
    estimated_price: number;
    reason: string;
    jump_keyword: string;
    regret_score: number;
    regret_reason: string;
}

function calibrateRecommendations(
    recommendations: Recommendation[],
    budgetLevel: number
): Recommendation[] {
    const priceRange = PRICE_RANGES[budgetLevel] || PRICE_RANGES[3];
    const platformFactor = PLATFORM_PRICE_FACTOR;

    return recommendations.map((rec: Recommendation) => {
        const factor = platformFactor[rec.platform] || 1.0;
        let price = rec.estimated_price;

        // 校准价格到合理范围
        if (price < priceRange.min) {
            price = priceRange.min + Math.random() * 5;
        } else if (price > priceRange.max) {
            price = priceRange.max - Math.random() * 5;
        }
        price = Math.round(price * factor);

        // 优化搜索关键词
        let keyword = rec.jump_keyword || `${rec.restaurant} ${rec.food_name}`;
        if (budgetLevel <= 2) {
            // 省钱模式：添加优惠关键词
            if (!keyword.includes('优惠') && !keyword.includes('套餐')) {
                keyword += ' 优惠';
            }
        } else if (budgetLevel >= 4) {
            // 奢侈模式：添加品质关键词
            if (!keyword.includes('品质') && !keyword.includes('甄选')) {
                keyword += ' 品质';
            }
        }

        return {
            ...rec,
            estimated_price: price,
            jump_keyword: keyword,
        };
    });
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

        // 校准推荐结果（价格和关键词优化）
        const calibratedRecommendations = calibrateRecommendations(
            aiResult.recommendations,
            input.budget_level
        );

        // 校准备选结果
        const calibratedAlternatives = aiResult.alternatives ? calibrateRecommendations(
            aiResult.alternatives.map((alt: { food_name: string; restaurant: string; platform: string; jump_keyword: string; estimated_price?: number }) => ({
                ...alt,
                estimated_price: alt.estimated_price || PRICE_RANGES[input.budget_level]?.min || 20,
                reason: '',
                regret_score: 3,
                regret_reason: ''
            })),
            input.budget_level
        ) : [];

        // 存储推荐结果
        const recommendationsToInsert = calibratedRecommendations.map((rec: Recommendation) => ({
            decision_id: decision.id,
            food_name: rec.food_name,
            restaurant: rec.restaurant,
            platform: rec.platform,
            estimated_price: rec.estimated_price,
            jump_keyword: rec.jump_keyword,
            explanation: rec.reason,
            regret_score: rec.regret_score,
        }));

        const { error: recError } = await supabase
            .from("recommendations")
            .insert(recommendationsToInsert);

        if (recError) {
            console.error("存储推荐失败:", recError);
            // 不抛出错误，继续返回结果
        }

        // 返回推荐结果（包含完整信息）
        return new Response(
            JSON.stringify({
                decision_id: decision.id,
                scene: aiResult.scene,
                budget_level: input.budget_level,
                price_range: aiResult.price_range || `${PRICE_RANGES[input.budget_level]?.min}-${PRICE_RANGES[input.budget_level]?.max}元`,
                recommendations: calibratedRecommendations,
                alternatives: calibratedAlternatives,
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
