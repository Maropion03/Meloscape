# Audio Visualizer | AI 视觉导演

一款受 [Mistral.ai](https://mistral.ai/) 视觉风格启发的实时音乐可视化单页应用。粘贴网易云 / QQ 音乐 / 酷狗歌曲链接，即可在浏览器中生成跟随节拍、情绪与段落变化的像素风景观。

![preview](assets/pixel-beach-oak-palms.png)

## 功能特性

- **多平台链接解析**：支持网易云音乐、QQ 音乐、酷狗音乐分享链接
- **实时音频分析**：BPM 检测、情绪识别、段落划分（intro/verse/chorus/bridge/outro）
- **5 套视觉景象**：根据音乐情绪自动切换
  - 余晖脉冲（neon）
  - 金色潮汐（golden）
  - 静海晚风（deepsea）
  - 像素棕榈（fractal）
  - 橡树影子（ink）
- **本地代理服务**：绕过音乐平台 CORS 限制，支持音频流代理
- **多种输入方式**：粘贴链接、拖放音频文件、点击上传

## 技术栈

- 前端：原生 HTML5 + CSS3 + Canvas + Web Audio API
- 后端：Node.js 本地代理服务器
- 音乐元数据：第三方网易云 API + QQ 音乐搜索接口

## 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/Maropion03/audio-visualizer.git
cd audio-visualizer

# 2. 启动本地服务（含 API 代理）
./start.sh

# 3. 浏览器打开
# http://localhost:8765
```

或者直接使用 Node：

```bash
node server.js
```

## 使用方式

1. 打开网页后，点击右下角 **Paste link** 或按 `SPACE` 播放示例
2. 粘贴网易云 / QQ 音乐 / 酷狗音乐链接，点击「解析」
3. 等待 1-3 秒，可视化景观会随音乐自动变化
4. 也可以直接拖入本地音频文件播放

## 项目结构

```
audio-visualizer/
├── assets/
│   └── pixel-beach-oak-palms.png   # 默认像素风背景
├── index.html                       # 单页应用主文件
├── server.js                        # Node.js 本地代理服务
├── start.sh                         # 一键启动脚本
└── README.md
```

## 注意事项

- 本项目仅供学习与技术交流使用
- 部分平台歌曲存在版权 / VIP 限制，可能无法获取到可播放音频源
- 音乐平台接口可能随时变化，解析失败时可尝试换一首免费歌曲

## License

MIT
