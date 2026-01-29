# 饮食觉察 - 部署指南

## 📁 项目文件结构

```
g:\eat\
├── code.html           # 输入表单页面（已有）
├── result.html         # 结果展示页面（新建）
├── app.js              # 前端交互逻辑（新建）
└── supabase/
    ├── schema.sql      # 数据库表结构（新建）
    └── functions/
        └── recommend/
            └── index.ts  # Edge Function（新建）
```

---

## 🚀 部署步骤

### 第一步：配置 Supabase 数据库

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 `lqqdhlxcfmdgxdayxxsi`
3. 进入 **SQL Editor**
4. 复制 `supabase/schema.sql` 的内容并执行

### 第二步：部署 Edge Function

```bash
# 安装 Supabase CLI (如果尚未安装)
npm install -g supabase

# 登录 Supabase
supabase login

# 链接到您的项目
cd g:\eat
supabase link --project-ref lqqdhlxcfmdgxdayxxsi

# 设置环境变量
supabase secrets set VOLCENGINE_API_KEY=ae53b373-bcb0-41a6-a957-213efaec4e2f

# 部署 Edge Function
supabase functions deploy recommend
```

### 第三步：获取 Supabase Anon Key

1. 在 Supabase Dashboard 中，进入 **Settings → API**
2. 找到 **Project API keys** 部分
3. 复制 `anon` `public` 密钥

### 第四步：配置前端

编辑 `app.js` 文件，将第 8 行的 `SUPABASE_ANON_KEY` 替换为您的实际密钥：

```javascript
const SUPABASE_ANON_KEY = '您的实际anon key';
```

### 第五步：在 code.html 中引入 app.js

在 `code.html` 的 `</body>` 标签前添加一行：

```html
<script src="app.js"></script>
</body>
```

### 第六步：本地测试

使用任意本地服务器运行，例如：

```bash
# 使用 Python
cd g:\eat
python -m http.server 8080

# 或使用 Node.js 的 serve
npx serve .
```

然后访问 `http://localhost:8080/code.html`

---

## 🔧 配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Supabase URL | `https://lqqdhlxcfmdgxdayxxsi.supabase.co` | 项目 URL |
| AI Model | `ep-m-20260121233537-m7xp4` | 火山方舟模型 ID |
| AI API Key | `ae53b373-bcb0-41a6-a957-213efaec4e2f` | 火山方舟 API Key |

---

## 📝 测试清单

- [ ] 数据库表创建成功
- [ ] Edge Function 部署成功
- [ ] 前端能正常提交表单
- [ ] 结果页能正确显示推荐
- [ ] 移动端显示正常
