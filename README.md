# 拾色 · Photo Color Match Skill

**先发样片，后续照片自动沿用其色调。** 支持能读取技能并运行本地命令的 Codex、WorkBuddy 等助手。另附手动浏览器界面。

本地运行，无需图像 API Key、账号或按次付费的调色网站。首次安装需下载依赖，照片处理不联网。

## 对话使用

安装后发样片并说：

> 用 photo-color-match 记住这张参考图，后面我发的照片都按它仿色。

随后发单张或一批原片即可。也可说“颜色淡一点”“加一点柔光”“换这张当样片”。样片副本与参数存到当前聊天工作区，原附件移走后仍可继续用。不同聊天各自保存样片。技能不会将私人照片同步到 GitHub。

## 从 GitHub 下载并安装

仓库：https://github.com/851627197-del/photo-color-match

直接下载 ZIP：https://github.com/851627197-del/photo-color-match/archive/refs/heads/main.zip

也可以在仓库 **Code → Download ZIP** 下载并解压整个文件夹，或 git clone。

Codex 可将仓库地址交给 Skill Installer：

> 从这个 GitHub 仓库根目录安装 photo-color-match 技能，检查 Node.js 并安装依赖。

WorkBuddy 或其他本地助手也可收到仓库链接或解压文件夹，再使用以下提示：

> 下载或读取这个技能目录的 SKILL.md，按你支持的机制安装为个人技能。准备 Node.js 20+ 和 sharp。以后我先发参考样片，后续照片沿用它仿色，各聊天分别保存样片。不要把我的照片上传到 GitHub。

不同助手的导入入口和安装目录可能不同；本次没有验证 WorkBuddy 的自动发现机制。脚本需要本地文件与命令执行能力，纯文字聊天客户端不能直接执行。

## 本地命令

安装 Node.js 20+（通常自带 npm），在技能目录执行：

```sh
npm install --omit=dev
node scripts/session.cjs reference "/photos/sample.jpg" --session "/my-work/style"
node scripts/session.cjs apply "/photos/a.jpg" "/photos/b.jpg" --out "/my-work/results" --session "/my-work/style"
node scripts/session.cjs settings --strength 0.55 --session "/my-work/style"
```

`--session` 必须放在技能目录之外，建议工作区 `.photo-color-match/<chat-id>`，每个聊天一个目录。省略时默认为当前工作目录的 `.photo-color-match/default`；通常应显式传入。

手动操作可直接打开 `index.html`，不需要 Node.js。浏览器页面不会读取脚本会话，重新打开需重新导入文件。

## 上传 GitHub

新建仓库，将本文件夹内的文件上传到仓库根目录，包括 `.gitignore` 和 `.github/`。不要上传 `node_modules`、会话目录、私人样片或处理结果。发布包不含照片、凭据或原电脑路径。

将仓库链接发给另一台电脑的助手，便可按上述说明下载安装。

## 格式与效果

支持 JPEG、PNG、WebP、TIFF，输出按 EXIF 转正的原尺寸 sRGB PNG，保留透明度，不覆盖原图。RAW/HEIC 先转换。可调强度、明暗迁移、曝光、对比、饱和度、冷暖、褪黑、柔光、颗粒。

使用 CIELAB 全局统计匹配，不重绘，也没有语义分割或专用肤色保护。内容和光线差别大时匹配程度有限。这是独立实现的同类功能，不是 Fotee 专有算法复刻。换电脑安装技能后新发样片，或主动迁移整个会话目录；不会自动同步。

## 测试与许可

`npm test` 覆盖样片跨多轮复用、换样片、独立会话、参数持久化、像素和透明度保护、不覆盖输出。GitHub Actions 配置了 Windows/macOS/Linux 测试；上传后实际运行结果才确认远端 CI 状态。

代码和文档为 MIT 许可；sharp 等依赖保留各自许可证。
