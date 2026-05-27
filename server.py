#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
饮食觉察 - 本地开发 & 智能 Mock 混合网关服务器
完美融合静态网页托管与动态心理配餐/复盘数据库API，打通本地与Supabase无缝切换。
"""

import os
import sys
import json
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080
REVIEWS_FILE = "local_reviews.json"
REAL_FOODS_FILE = "real_foods.json"

# 基于《夜宵消费心理学》的智能模板数据库
PSYCHOLOGICAL_TEMPLATES = {
    "stressed": {
        "price_range": "25-45元",
        "recommendations": [
            {
                "food_name": "招牌骨汤麻辣烫单人豪华餐",
                "restaurant": "杨国福麻辣烫 (中关村店)",
                "platform": "meituan",
                "estimated_price": 32.8,
                "reason": "【💥 解压发泄型】辛辣饱腹释放压力。💡 朋克养生对冲：默认搭配【无糖茶/东方树叶】解腻，降低明日负罪感！",
                "jump_keyword": "杨国福麻辣烫 招牌骨汤麻辣烫",
                "regret_score": 2,
                "regret_reason": "已搭配无糖绿茶，对冲高热量负罪感"
            },
            {
                "food_name": "超辣秘制烤串大份 (10支)",
                "restaurant": "丰茂烤串 (知春路店)",
                "platform": "eleme",
                "estimated_price": 45.0,
                "reason": "【💥 解压发泄型】油脂焦香带来多巴胺极速释放。💡 朋克养生对冲：默认建议搭配【金银花露】以防上火！",
                "jump_keyword": "丰茂烤串 知春路店 烤串",
                "regret_score": 3,
                "regret_reason": "已默认搭配金银花茶，解腻又防火"
            },
            {
                "food_name": "香辣鸡腿堡+原味鸡双人特惠",
                "restaurant": "肯德基 (中关村科技园店)",
                "platform": "meituan",
                "estimated_price": 39.9,
                "reason": "【💥 解压发泄型】物理大口咀嚼解压。💡 朋克养生对冲：建议睡前对冲一片【护肝片】降低悔恨！",
                "jump_keyword": "肯德基 炸鸡 优惠套餐",
                "regret_score": 2,
                "regret_reason": "已进行护肝片 risk-hedging 对冲"
            },
            {
                "food_name": "深夜解压经典麻辣拌单人餐",
                "restaurant": "张亮麻辣烫 (海淀黄庄店)",
                "platform": "jd",
                "estimated_price": 28.5,
                "reason": "【💥 解压发泄型】麻辣爆爽口感，极速释放抑郁。💡 朋克养生对冲：默认搭配【无糖大麦茶】！",
                "jump_keyword": "张亮麻辣烫 经典麻辣拌",
                "regret_score": 2,
                "regret_reason": "已默认搭配东方树叶，对冲油腻感"
            },
            {
                "food_name": "爆辣无骨鸡爪+清爽果切拼盘",
                "restaurant": "百果园与脱骨爪 (联名套餐)",
                "platform": "eleme",
                "estimated_price": 35.0,
                "reason": "【💥 解压发泄型】酸辣爽脆。💡 朋克养生对冲：自带时令新鲜西瓜切，辣甜平衡无负担！",
                "jump_keyword": "脱骨鸡爪 百果园果切",
                "regret_score": 1,
                "regret_reason": "果切纤维素对冲，极低热量留存"
            }
        ],
        "alternatives": [
            {
                "food_name": "便利店关东煮暖心三人组",
                "restaurant": "便利蜂 (中关村店)",
                "platform": "meituan",
                "estimated_price": 15.0,
                "jump_keyword": "便利蜂 关东煮"
            }
        ]
    },
    "homesick": {
        "price_range": "15-30元",
        "recommendations": [
            {
                "food_name": "温润滋补砂锅皮蛋瘦肉粥",
                "restaurant": "三顾粥铺 (海淀店)",
                "platform": "meituan",
                "estimated_price": 19.8,
                "reason": "【🥬 自我补偿型】清淡温热，深夜一人食，极低脂，暖胃更暖心，无任何发胖悔恨感。",
                "jump_keyword": "三顾粥铺 皮蛋瘦肉粥",
                "regret_score": 1,
                "regret_reason": "极致低脂肪流食，完全无悔恨感"
            },
            {
                "food_name": "妈妈手工猪肉白菜水饺大份",
                "restaurant": "大娘水饺 (知春路店)",
                "platform": "eleme",
                "estimated_price": 22.5,
                "reason": "【🥬 自我补偿型】温热扎实的手工饺子，吃出家乡的纯朴温暖，热量极低且营养均衡。",
                "jump_keyword": "大娘水饺 猪肉白菜",
                "regret_score": 1,
                "regret_reason": "手工面食纯净无添加，悔恨极低"
            },
            {
                "food_name": "热气腾腾红烧排骨大份煨面",
                "restaurant": "九毛九面馆 (金源店)",
                "platform": "meituan",
                "estimated_price": 29.0,
                "reason": "【🥬 自我补偿型】暖和的骨汤与顺滑面条，温热汤汁抚平深夜思乡之情，对肠胃零负担。",
                "jump_keyword": "九毛九 红烧排骨面",
                "regret_score": 2,
                "regret_reason": "热骨汤促进代谢，暖胃高回购"
            },
            {
                "food_name": "清香芹菜木耳鲜肉水饺大份",
                "restaurant": "袁记云饺 (海淀黄庄店)",
                "platform": "meituan",
                "estimated_price": 24.0,
                "reason": "【🥬 自我补偿型】高膳食纤维芹菜与木耳，配上精选鲜肉，皮薄馅大，低盐无油，极其健康。",
                "jump_keyword": "袁记云饺 鲜肉饺子",
                "regret_score": 1,
                "regret_reason": "芹菜降压木耳吸油，健康满分"
            },
            {
                "food_name": "老北京传统纯绿豆手工马蹄爽",
                "restaurant": "老北京传统甜品铺 (五道口店)",
                "platform": "jd",
                "estimated_price": 18.0,
                "reason": "【🥬 自我补偿型】马蹄清凉爽口，绿豆沙温润解暑。清淡甘甜，清热降火，完美宵夜良伴。",
                "jump_keyword": "手工绿豆沙 马蹄爽",
                "regret_score": 1,
                "regret_reason": "纯粗粮甜品降燥，健康养颜"
            }
        ],
        "alternatives": [
            {
                "food_name": "新鲜时令果切拼盘500g",
                "restaurant": "百果园 (海淀黄庄店)",
                "platform": "eleme",
                "estimated_price": 22.0,
                "jump_keyword": "百果园 果切"
            }
        ]
    },
    "finished_work": {
        "price_range": "28-55元",
        "recommendations": [
            {
                "food_name": "麻辣香锅自由搭配单人特惠",
                "restaurant": "张亮麻辣香锅 (海淀黄庄店)",
                "platform": "meituan",
                "estimated_price": 35.0,
                "reason": "【💊 朋克养生型】重口味自我犒赏。💡 朋克养生对冲：默认赠送【东方树叶茉莉花茶】，油脂当场对冲！",
                "jump_keyword": "张亮麻辣香锅 单人套餐",
                "regret_score": 2,
                "regret_reason": "已赠送茉莉花茶，完美化解高油高盐"
            },
            {
                "food_name": "黄金脆皮炸鸡半只特配装",
                "restaurant": "麦当劳麦乐送 (中关村科技店)",
                "platform": "meituan",
                "estimated_price": 28.5,
                "reason": "【💊 朋克养生型】高能量犒劳。💡 朋克养生对冲：默认建议搭配【无糖黑咖啡】，解腻抗氧化！",
                "jump_keyword": "麦当劳 脆皮炸鸡 东方树叶",
                "regret_score": 2,
                "regret_reason": "黑咖啡助胃排空，加速脂肪代谢"
            },
            {
                "food_name": "精品多巴胺烤肥牛大份 (15支)",
                "restaurant": "丰茂烤串 (知春路店)",
                "platform": "eleme",
                "estimated_price": 55.0,
                "reason": "【💊 朋克养生型】烤肥牛美味爆表。💡 朋克养生对冲：默认建议搭配一杯【热蒲公英茶】降火防燥！",
                "jump_keyword": "丰茂烤串 烤肥牛 知春路",
                "regret_score": 3,
                "regret_reason": "已默认建议配蒲公英降火茶，防长痘"
            },
            {
                "food_name": "招牌芝士厚乳流心红薯披萨",
                "restaurant": "比格披萨 (五道口店)",
                "platform": "meituan",
                "estimated_price": 42.0,
                "reason": "【💊 朋克养生型】碳水大满足。💡 朋克养生对冲：采用高纤维红薯底，极大缓和餐后血糖波动！",
                "jump_keyword": "比格披萨 红薯披萨 茉莉花茶",
                "regret_score": 2,
                "regret_reason": "高纤维杂粮面底，不易储存体脂"
            },
            {
                "food_name": "精致法式鹅肝鹅油炒饭单人餐",
                "restaurant": "西堤牛排 (中关村店)",
                "platform": "jd",
                "estimated_price": 49.0,
                "reason": "【💊 朋克养生型】法式浪漫美味。💡 朋克养生对冲：炒饭默认加入芹菜碎与洋葱，全面降低油脂吸收！",
                "jump_keyword": "西堤牛排 鹅肝炒饭",
                "regret_score": 2,
                "regret_reason": "洋葱膳食纤维完美中和鹅油"
            }
        ],
        "alternatives": [
            {
                "food_name": "大麦青汁多维能量代餐粉",
                "restaurant": "超级零 (健康生活店)",
                "platform": "meituan",
                "estimated_price": 25.0,
                "jump_keyword": "超级零 大麦青汁"
            }
        ]
    },
    "lonely": {
        "price_range": "15-28元",
        "recommendations": [
            {
                "food_name": "深夜灵魂治愈关东煮7串特惠",
                "restaurant": "便利蜂 (中关村科技园店)",
                "platform": "meituan",
                "estimated_price": 15.0,
                "reason": "【🎁 猎奇/省心型】暖身温热。关东煮的温暖汤头最能消解深夜孤独，清淡极低卡，美味零负担！",
                "jump_keyword": "便利蜂 关东煮 7串",
                "regret_score": 1,
                "regret_reason": "蔬菜与高弹鱼丸为主，热量低于200大卡"
            },
            {
                "food_name": "招牌照烧鸡腿排双拼饭大餐",
                "restaurant": "吉野家 (知春路店)",
                "platform": "meituan",
                "estimated_price": 25.8,
                "reason": "【🎁 猎奇/省心型】一人食经典。营养搭配合理，滑嫩鸡腿排搭清爽配菜，闭眼点绝不踩雷！",
                "jump_keyword": "吉野家 照烧鸡腿饭",
                "regret_score": 2,
                "regret_reason": "经典健康禽肉碳水，高饱腹省心选择"
            },
            {
                "food_name": "热销正宗浓郁豚骨叉烧拉面",
                "restaurant": "拉面说 (海淀概念店)",
                "platform": "eleme",
                "estimated_price": 28.0,
                "reason": "【🎁 猎奇/省心型】浓郁汤底治愈心灵。大块叉烧配合软糯面条，深夜独自一人吃饱的极致仪式感。",
                "jump_keyword": "拉面说 叉烧豚骨拉面",
                "regret_score": 2,
                "regret_reason": "大碗面汤高盐，已用多喝白水稀释策略对冲"
            },
            {
                "food_name": "日式招牌牛肉咖喱乌冬面",
                "restaurant": "丸龟制面 (海淀黄庄店)",
                "platform": "meituan",
                "estimated_price": 26.5,
                "reason": "【🎁 猎奇/省心型】香浓微辣。日式咖喱富含姜黄素，助代谢，搭配爽滑Q弹乌冬面，暖心省力。",
                "jump_keyword": "丸龟制面 咖喱乌冬",
                "regret_score": 2,
                "regret_reason": "姜黄素抗炎促代谢，胃部舒适"
            },
            {
                "food_name": "照烧银鳕鱼饭团+新鲜香蕉",
                "restaurant": "罗森便利店 (五道口店)",
                "platform": "eleme",
                "estimated_price": 18.0,
                "reason": "【🎁 猎奇/省心型】手持冷食饱腹。便利店经典美味，蛋白质与优质碳水完美结合，吃完倒头安睡。",
                "jump_keyword": "罗森 照烧饭团 香蕉",
                "regret_score": 1,
                "regret_reason": "纯正日式饭团低油脂低盐，毫无罪恶"
            }
        ],
        "alternatives": [
            {
                "food_name": "新鲜时令红提果切盒200g",
                "restaurant": "果多美 (中关村店)",
                "platform": "meituan",
                "estimated_price": 12.0,
                "jump_keyword": "果多美 提子果切"
            }
        ]
    }
}

class CustomHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()

    def do_POST(self):
        path = self.path
        
        # 1. 路由分配：拦截 recommend API
        if "/functions/v1/recommend" in path or "/api/functions/v1/recommend" in path:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.end_headers()

            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                req_data = json.loads(post_data.decode('utf-8'))
            except Exception:
                req_data = {}

            # 读取用户参数
            mood = req_data.get("mood", "stressed")
            if mood not in PSYCHOLOGICAL_TEMPLATES:
                mood = "stressed"

            # 提取模板数据
            template = PSYCHOLOGICAL_TEMPLATES[mood]
            
            # 如果存在 real_foods.json，用爬取出来的真实数据替换第一、二个推荐，凸显爬虫成果！
            real_foods = []
            if os.path.exists(REAL_FOODS_FILE):
                try:
                    with open(REAL_FOODS_FILE, 'r', encoding='utf-8') as f:
                        real_foods = json.load(f).get("recommendations", [])
                except Exception:
                    real_foods = []

            final_recs = list(template["recommendations"])
            # 如果有真实爬取的数据，用它替换部分数据以展现爬虫威力！
            if len(real_foods) > 0:
                for idx, r_food in enumerate(real_foods[:2]):
                    if idx < len(final_recs):
                        final_recs[idx] = r_food

            response_data = {
                "scene": "夜晚" if req_data.get("time_of_day") == "nighttime" else "白天",
                "budget_level": req_data.get("budget_level", 3),
                "price_range": template["price_range"],
                "recommendations": final_recs,
                "alternatives": template["alternatives"]
            }

            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            return

        # 2. 路由分配：拦截 meal_reviews 保存 API (我已下单)
        elif "/rest/v1/meal_reviews" in path or "/api/rest/v1/meal_reviews" in path:
            self.send_response(201)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.end_headers()

            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                req_data = json.loads(post_data.decode('utf-8'))
            except Exception:
                req_data = {}

            reviews = []
            if os.path.exists(REVIEWS_FILE):
                try:
                    with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
                        reviews = json.load(f)
                except Exception:
                    reviews = []

            if isinstance(req_data, list):
                for item in req_data:
                    item['id'] = len(reviews) + 1
                    reviews.append(item)
            else:
                req_data['id'] = len(reviews) + 1
                reviews.append(req_data)

            with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
                json.dump(reviews, f, indent=2, ensure_ascii=False)

            self.wfile.write(json.dumps({"status": "success", "message": "Saved to local reviews!"}).encode('utf-8'))
            return

        # 3. 路由分配：拦截 review-analysis AI 分析 API
        elif "/functions/v1/review-analysis" in path or "/api/functions/v1/review-analysis" in path:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.end_headers()

            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                req_data = json.loads(post_data.decode('utf-8'))
            except Exception:
                req_data = {}

            reviews = req_data.get("reviews", [])
            total_meals = len(reviews)
            avg_regret = sum(r.get("regret_score", 3) for r in reviews) / total_meals if total_meals else 3
            avg_price = sum(r.get("price", 0) for r in reviews) / total_meals if total_meals else 0
            
            analysis = (
                f"📊 【本地饮食觉察 AI 智能报告】\n\n"
                f"根据您提交的 {total_meals} 次用餐记录进行行为特征建模：\n"
                f"• 平均单餐支出：¥{avg_price:.1f}\n"
                f"• 平均明早后悔度：{avg_regret:.2f} 星 (最高 5 星)\n\n"
                f"🧠 【认知调和控制反馈】\n"
            )
            
            if avg_regret >= 3.5:
                analysis += (
                    "⚠️ 指标预警：您的后悔度偏高，显示出了明显的宵夜行为与健康自我认知之间的认知失调。\n"
                    "💡 专家建议：不要盲目抑制吃夜宵的欲望，而是改用【朋克养生对冲法】。即在点重口味、油炸放纵宵夜（如炸鸡、麻辣烫）的同时，强制自己打包购买一瓶【无糖乌龙茶/金银花露】，或者在床头放置一盒【护肝片】进行风险对冲。这样既能保证当下的多巴胺分泌释放压力，又能有效降低明早的生理负罪感和内疚，实现心理的软着陆。"
                )
            else:
                analysis += (
                    "🎉 表现优异：您的后悔星级保持在较低水平！这显示您在满足“肚子发泄”的同时，成功利用了“朋克养生对冲”（搭配无糖茶、吃低卡高饱腹食物等）进行了完美的风险控制。\n"
                    "💡 专家建议：维持目前的饮食模式，您的胃与您的大脑已处于极度和谐的状态，没有任何暴食或报复性进食的倾向。继续加油！"
                )

            self.wfile.write(json.dumps({"analysis": analysis}, ensure_ascii=False).encode('utf-8'))
            return

        else:
            self.send_error(404, "Unknown API route")

    def do_GET(self):
        path = self.path
        
        # 1. 路由分配：拦截 meal_reviews 获取 API (查看复盘数据)
        if "/rest/v1/meal_reviews" in path or "/api/rest/v1/meal_reviews" in path:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.end_headers()

            reviews = []
            if os.path.exists(REVIEWS_FILE):
                try:
                    with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
                        reviews = json.load(f)
                except Exception:
                    reviews = []
            
            # 按时间戳从新到旧排序
            try:
                reviews.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            except Exception:
                pass

            # 如果数据量较少，自动填充默认本地初始复盘数据以备预览
            if len(reviews) == 0:
                reviews = [
                    {
                        "food_name": "清炒西兰花+热稀饭",
                        "price": 15,
                        "fullness": 2,
                        "mood": "satisfied",
                        "regret_score": 1,
                        "note": "自我补偿型，吃完胃里很暖，非常养胃，完全不后悔",
                        "created_at": "2026-05-26T23:30:00.000Z"
                    },
                    {
                        "food_name": "招牌骨汤麻辣烫大份",
                        "price": 32.8,
                        "fullness": 1,
                        "mood": "happy",
                        "regret_score": 2,
                        "note": "解压发泄型，爆爽！搭配了东方树叶绿茶，把负罪感对冲掉了，挺好",
                        "created_at": "2026-05-25T23:45:00.000Z"
                    },
                    {
                        "food_name": "肯德基香辣鸡翅+薯条",
                        "price": 28,
                        "fullness": 1,
                        "mood": "guilty",
                        "regret_score": 4,
                        "note": "炸鸡油脂太高了，吃完胃里胀气。明天早上要多跑两公里了，有点后悔",
                        "created_at": "2026-05-24T23:15:00.000Z"
                    }
                ]

            self.wfile.write(json.dumps(reviews, ensure_ascii=False).encode('utf-8'))
            return

        # 2. 默认行为：继承 SimpleHTTPRequestHandler 进行本地网页托管服务
        return super().do_GET()

def run(server_class=HTTPServer, handler_class=CustomHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"🚀 【智能开发服务器】正在本地完美监听端口 {PORT}...")
    print(f"🔗 前端访问入口：http://localhost:{PORT}/index.html")
    print(f"💡 Deno/Supabase API 本地 Mock 路由已全部开通！")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已优雅关闭。")
        sys.exit(0)

if __name__ == '__main__':
    run()
