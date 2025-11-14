/**
 * 音效管理器 - 参考 frontend 实现
 */

class SoundManager {
  private audioContext: AudioContext | null = null
  private soundEnabled: boolean = true
  private initialized: boolean = false

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

  /**
   * 播放音效
   */
  playSound(soundName: string) {
    if (!this.initialized || !this.soundEnabled || !this.audioContext) {
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
      default:
        this.playSound('play')
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
}

// 导出单例
export const soundManager = new SoundManager()
