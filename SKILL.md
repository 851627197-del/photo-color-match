---
name: photo-color-match
description: 参考图仿色：先发一张样片，后续照片自动沿用该样片与调色参数，支持连续多轮、批量、柔光、颗粒和换样片。用于保留原片内容的色调统一，不用于重绘或人脸编辑。
---

# 参考图仿色 · 样片记忆

用自带脚本对原片做确定性调色，不生成或重绘照片。这是独立实现的同类功能，不宣称与 Fotee 专有算法相同。

## 对话规则

- 用户先发“参考图/样片”时，立即将其保存为当前聊天样片并简短确认。后续上传照片沿用它处理，不重复索要样片或要求用户点网页。
- 用户一次发多张并说明“第一张是参考图”时，仅将后面的照片列入处理。没有样片且无法区分图片角色时才询问。
- 已有样片后，新发照片默认是待处理原片。只有“换参考图/这张当样片”等指令才替换样片。
- 用户说“淡一点/更暖/加颗粒”等时调整参数，记住用户认可的设置供后续沿用。默认强度 0.7、明暗迁移 0.35，其余 0；人像先检查肤色，必要时降低强度。
- 使用真实附件的本地文件。只有附件 ID 时，先用宿主工具落盘；不能臆造路径或仅凭文案声称已处理。

## 会话与隐私

第一次在当前工作区选固定目录，如 `<workspace>/.photo-color-match/<chat-id>`，此聊天后续始终传同一个 `--session`。宿主没有稳定 chat ID 时生成随机 ID，并在对话中记住目录。不同聊天不要共用目录；上下文丢失又有多个目录时，先根据对话线索定位，仍不确定再询问。

保存的是样片副本和参数 JSON，不依赖原附件临时文件一直存在。目录必须放在技能目录之外，**不要上传私人样片或会话数据到 GitHub**。换电脑安装工具后先提供样片，或由用户主动迁移整个会话目录；不会自动同步私人照片。

## 脚本

需要 Node.js 20+ 和 sharp。在技能目录执行 `npm install --omit=dev`；宿主已有 sharp 时可用 NODE_PATH 复用，不写死本机路径。

以下脚本路径相对于技能根目录；实际调用传技能、照片和会话的绝对路径，无需改变工作区目录：

```sh
node scripts/session.cjs reference "/photos/sample.jpg" --session "/workspace/.photo-color-match/chat-id"
node scripts/session.cjs apply "/photos/a.jpg" "/photos/b.jpg" --out "/workspace/results" --session "/workspace/.photo-color-match/chat-id"
node scripts/session.cjs settings --strength 0.55 --glow 0.1 --session "/workspace/.photo-color-match/chat-id"
node scripts/session.cjs status --session "/workspace/.photo-color-match/chat-id"
```

`reference` 保存样片，`apply` 沿用样片；`settings` 修改并记住参数，`status` 查看当前状态。`apply` 也接受参数，全部处理成功后保存为会话设置。没有样片时 apply 明确报错。

`apply` 可传照片文件夹（只扫直接子文件）；不要把参考图包含在待处理输入中。同名输出加序号、不覆盖原片。输出按 EXIF 转正的原尺寸 sRGB PNG，保留透明度、不复制 GPS/EXIF。支持 JPG、PNG、WebP、TIFF；RAW/HEIC 先转换。

strength、tone、fade、glow、grain 范围 0–1；exposure 为 -2–2；contrast、saturation、warmth 为 -1–1。单张失败继续处理其他照片，交付成功结果并报告失败。

## 检查与交付

查看原片、样片和结果，检查肤色、天空、白色物体与暗部。明显偏色时降低强度或 tone。全局统计匹配不理解物体语义；参考和原片内容、光线差别大会降低相似程度。交付结果和参数文件，不把合成测试声称为真实照片效果验证。

用户想自己滑动调节时提供 `index.html`，`engine.js` 放在旁边。浏览器刷新后需重新导入文件；上述会话记忆通过脚本提供。安装和 GitHub 发布详见 [README](README.md)。
