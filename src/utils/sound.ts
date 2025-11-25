/**
 * 音效管理器 - 参考 frontend 实现
 */

class SoundManager {
  private audioContext: AudioContext | null = null
  private soundEnabled: boolean = true
  private musicEnabled: boolean = true
  private initialized: boolean = false
  private backgroundAudio: HTMLAudioElement | null = null
  private soundMap: Record<string, HTMLAudioElement> = {}

  /**
   * 初始化音频系统
   */
  init() {
    if (this.initialized) return
    
    try {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContext()
      this.initialized = true
      console.log('🔊 音效系统已初始化')
    } catch (error) {
      console.error('❌ 音效系统初始化失败:', error)
    }
  }

  private getAudioSrcForSound(soundName: string): string | null {
    switch (soundName) {
      case 'bomb':
        return '/sounds/zhadan.mp3'
      case 'rocket':
        return '/sounds/王炸.mp3'
      case 'bid':
        return '/sounds/jiaodizhu.mp3'
      case 'plane':
        return '/sounds/飞机.mp3'
      case 'deal':
        return '/sounds/发牌.mp3'
      case 'pass':
        return '/sounds/要不起.mp3'
      case 'win':
        return '/sounds/赢牌.mp3'
      case 'lose':
        return '/sounds/输牌.mp3'
      case 'triple_with_single':
        return '/sounds/三带一.mp3'
      default:
        return null
    }
  }

  /**
   * 播放音效
   */
  playSound(soundName: string) {
    if (!this.soundEnabled) {
      return
    }

    const audioSrc = this.getAudioSrcForSound(soundName)
    if (audioSrc) {
      try {
        let audio = this.soundMap[soundName]
        if (!audio) {
          audio = new Audio(audioSrc)
          audio.volume = 0.8
          this.soundMap[soundName] = audio
        }
        audio.currentTime = 0
        audio
          .play()
          .catch((error) => {
            console.error('❌ 播放音效失败:', error)
          })
        return
      } catch (error) {
        console.error('❌ 播放音效失败:', error)
      }
    }

    if (!this.initialized) {
      this.init()
    }

    if (!this.initialized || !this.audioContext) {
      return
    }

    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // 根据不同音效设置不同的频率和持续时间
      switch (soundName) {
        case 'click':
          oscillator.frequency.value = 800
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.1)
          break

        case 'play':
          oscillator.frequency.value = 600
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.2)
          break

        case 'pass':
          oscillator.frequency.value = 400
          gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.15)
          break

        case 'hint':
          oscillator.frequency.value = 1000
          gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.1)
          break

        case 'bid':
          // 抢地主音效 - 明显但不刺耳
          oscillator.frequency.value = 900
          gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.2)
          break

        case 'bomb':
          // 炸弹音效 - 低频爆炸声
          oscillator.type = 'sawtooth'
          oscillator.frequency.value = 100
          gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.5)
          break

        case 'rocket':
          // 王炸音效 - 高频爆炸声
          oscillator.type = 'sawtooth'
          oscillator.frequency.value = 200
          gainNode.gain.setValueAtTime(0.6, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.6)
          break

        case 'plane':
          // 飞机音效
          oscillator.type = 'sine'
          oscillator.frequency.value = 700
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.3)
          break

        default:
          oscillator.frequency.value = 500
          gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.1)
      }
    } catch (error) {
      console.error('❌ 播放音效失败:', error)
    }
  }

  playVoice(text: string) {
    if (!this.soundEnabled) {
      return
    }
    if (!text) {
      return
    }
    if (typeof window === 'undefined') {
      return
    }

    const w = window as any
    const synth: SpeechSynthesis | null =
      (w.speechSynthesis as SpeechSynthesis | undefined) ||
      (w.webkitSpeechSynthesis as SpeechSynthesis | undefined) ||
      null

    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      return
    }

    try {
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      try {
        const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
        if (voices && voices.length > 0) {
          const zhVoices = voices.filter((v) => v && typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('zh'))
          const preferred =
            zhVoices.find((v) =>
              typeof v.name === 'string' && /female|女|xiaoyi|xiaolei|huihui|yaoyao/i.test(v.name),
            ) || zhVoices[0] || voices[0]
          if (preferred) {
            utterance.voice = preferred
          }
        }
      } catch (e) {
      }

      utterance.rate = 1.1
      utterance.pitch = 1.1
      synth.speak(utterance)
    } catch (error) {
      console.error('❌ 语音播报失败:', error)
    }
  }

  /**
   * 根据牌型播放音效
   */
  playCardTypeSound(cardType: any) {
    if (!cardType) {
      this.playSound('play')
      return
    }

    const type = cardType.type || cardType.TYPE
    switch (type?.toLowerCase()) {
      case 'bomb':
        this.playSound('bomb')
        break
      case 'rocket':
        this.playSound('rocket')
        break
      case 'airplane':
      case 'airplane_with_wings':
      case 'plane':
      case 'plane_plus_wings':
        this.playSound('plane')
        break
      case 'triple_with_single':
        this.playSound('triple_with_single')
        break
      default:
        this.playSound('play')
    }
  }

  /** 简单封装：提示音 */
  playHint() {
    this.playSound('hint')
  }

  /** 简单封装：不出音效 */
  playPass() {
    this.playSound('pass')
  }

  /** 简单封装：赢牌音效 */
  playWin() {
    this.playSound('win')
  }

  /** 简单封装：输牌音效 */
  playLose() {
    this.playSound('lose')
  }

  /** 简单封装：抢地主音效 */
  playBid() {
    this.playSound('bid')
  }

  /** 简单封装：轮到你出牌等通用点击音 */
  playTurnStart() {
    this.playSound('click')
  }

  playBackgroundMusic() {
    if (!this.musicEnabled) {
      return
    }

    try {
      if (!this.backgroundAudio) {
        this.backgroundAudio = new Audio('/sounds/background.wav')
        this.backgroundAudio.loop = true
        this.backgroundAudio.volume = 0.4
      }

      this.backgroundAudio.currentTime = 0
      this.backgroundAudio
        .play()
        .catch((error) => {
          console.error('❌ 播放背景音乐失败:', error)
        })
    } catch (error) {
      console.error('❌ 初始化背景音乐失败:', error)
    }
  }

  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause()
      this.backgroundAudio.currentTime = 0
    }
  }

  /**
   * 设置音效开关
   */
  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }

  /**
   * 获取音效状态
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled
    if (!enabled) {
      this.stopBackgroundMusic()
    }
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled
  }
}

// 导出单例
export const soundManager = new SoundManager()
