# 音效文件说明

## 📁 目录结构

```
sounds/
├── README.md           # 本文件
├── click.mp3          # 按钮点击音效
├── deal.mp3           # 发牌音效
├── play.mp3           # 普通出牌音效
├── pass.mp3           # 不出音效
├── bomb.mp3           # 炸弹音效
├── rocket.mp3         # 王炸音效
├── plane.mp3          # 飞机音效
├── bid.mp3            # 抢地主音效
├── landlord.mp3       # 地主确定音效
├── win.mp3            # 胜利音效
├── lose.mp3           # 失败音效
├── hint.mp3           # 提示音效
├── warning.mp3        # 警告音效
├── timer.mp3          # 倒计时音效
├── bg-lobby.mp3       # 大厅背景音乐
└── bg-game.mp3        # 游戏背景音乐
```

## 🎵 音效来源

### 免费音效库推荐

1. **Freesound** (https://freesound.org/)
   - 免费、高质量
   - 需要注册
   - CC协议

2. **Zapsplat** (https://www.zapsplat.com/)
   - 免费下载
   - 商用需标注

3. **Mixkit** (https://mixkit.co/free-sound-effects/)
   - 完全免费
   - 可商用

4. **Pixabay** (https://pixabay.com/sound-effects/)
   - 免费
   - 无需标注

### 推荐搜索关键词

- **click.mp3**: "button click", "ui click", "soft click"
- **deal.mp3**: "card shuffle", "card deal", "poker deal"
- **play.mp3**: "card place", "card drop", "card play"
- **pass.mp3**: "negative", "cancel", "no"
- **bomb.mp3**: "explosion", "bomb", "blast"
- **rocket.mp3**: "rocket launch", "whoosh", "power up"
- **plane.mp3**: "airplane", "jet", "fly"
- **bid.mp3**: "coin", "ding", "notification"
- **landlord.mp3**: "fanfare", "victory short", "achievement"
- **win.mp3**: "victory", "win", "success"
- **lose.mp3**: "fail", "lose", "game over"
- **hint.mp3**: "hint", "tip", "notification"
- **warning.mp3**: "alert", "warning", "beep"
- **timer.mp3**: "tick", "clock", "countdown"
- **bg-lobby.mp3**: "lobby music", "menu music", "casual music"
- **bg-game.mp3**: "game music", "background music", "upbeat music"

## 📝 音效规格建议

### 音效文件
- **格式**: MP3 (兼容性好)
- **比特率**: 128kbps (平衡质量和大小)
- **采样率**: 44.1kHz
- **时长**: 0.5-2秒 (短音效)
- **音量**: 归一化到 -3dB

### 背景音乐
- **格式**: MP3
- **比特率**: 192kbps
- **采样率**: 44.1kHz
- **时长**: 2-5分钟 (循环播放)
- **音量**: 归一化到 -6dB (比音效小)

## 🛠️ 音频处理工具

### 在线工具
1. **Audio Trimmer** (https://audiotrimmer.com/)
   - 裁剪音频
   - 格式转换

2. **Online Audio Converter** (https://online-audio-converter.com/)
   - 格式转换
   - 比特率调整

3. **MP3 Louder** (https://www.mp3louder.com/)
   - 音量调整
   - 归一化

### 桌面软件
1. **Audacity** (免费)
   - 专业音频编辑
   - 支持所有格式

2. **Adobe Audition** (付费)
   - 专业级工具
   - 高级处理

## 🎨 临时替代方案

在获取真实音效前，可以使用以下方法：

### 1. 使用Web Audio API生成简单音效

```javascript
// 生成简单的哔哔声
function beep(duration = 200, frequency = 440) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}
```

### 2. 使用占位符音频

创建静音文件作为占位符，避免加载错误：

```bash
# 使用FFmpeg创建1秒静音MP3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame silence.mp3
```

## 📋 集成清单

- [x] SoundManager类已创建
- [ ] 下载/创建音效文件
- [ ] 测试音效播放
- [ ] 集成到游戏流程
- [ ] 添加音量控制UI
- [ ] 性能测试
- [ ] 浏览器兼容性测试

## 🔧 使用示例

```javascript
// 播放点击音效
SoundManager.playClick();

// 播放出牌音效（根据牌型）
SoundManager.playCardType(cardType);

// 播放背景音乐
SoundManager.playBgMusic('game');

// 调整音量
SoundManager.setVolume(0.7);

// 静音
SoundManager.setEnabled(false);
```

## ⚠️ 注意事项

1. **浏览器自动播放策略**
   - 需要用户交互后才能播放音频
   - 首次点击后启用音效

2. **文件大小**
   - 控制音效文件大小
   - 使用适当的压缩率
   - 考虑懒加载

3. **性能**
   - 预加载常用音效
   - 避免同时播放过多音效
   - 使用音频池复用

4. **版权**
   - 确保音效可商用
   - 保留必要的版权声明
   - 遵守CC协议

---

**创建时间**: 2025-10-29
**维护者**: 开发团队
