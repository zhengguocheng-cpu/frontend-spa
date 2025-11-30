/**
 * 临时音效生成器
 * 使用Web Audio API生成简单音效，作为真实音效文件的临时替代
 * 创建时间：2025-10-29
 */

class TempSoundGenerator {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        
        console.log('🎵 TempSoundGenerator initialized');
    }
    
    /**
     * 初始化AudioContext（需要用户交互）
     */
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🎵 AudioContext created');
        }
        return this.audioContext;
    }
    
    /**
     * 播放简单音调
     */
    playTone(frequency = 440, duration = 200, type = 'sine') {
        if (!this.enabled) return;
        
        const ctx = this.init();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
    }
    
    /**
     * 点击音效
     */
    click() {
        this.playTone(800, 50, 'sine');
    }
    
    /**
     * 发牌音效
     */
    deal() {
        const ctx = this.init();
        const now = ctx.currentTime;
        
        // 快速的音阶下降
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.playTone(600 - i * 100, 80, 'triangle');
            }, i * 30);
        }
    }
    
    /**
     * 出牌音效
     */
    play() {
        this.playTone(500, 150, 'triangle');
    }
    
    /**
     * 不出音效
     */
    pass() {
        this.playTone(300, 200, 'sawtooth');
    }
    
    /**
     * 炸弹音效
     */
    bomb() {
        const ctx = this.init();
        
        // 爆炸效果：低频噪音
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 100;
        
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        
        gainNode.gain.setValueAtTime(this.volume * 1.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    }
    
    /**
     * 王炸音效
     */
    rocket() {
        const ctx = this.init();
        
        // 上升音调
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
    }
    
    /**
     * 飞机音效
     */
    plane() {
        // 快速的音阶上升
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.playTone(400 + i * 100, 60, 'square');
            }, i * 40);
        }
    }
    
    /**
     * 抢地主音效
     */
    bid() {
        this.playTone(700, 150, 'sine');
        setTimeout(() => {
            this.playTone(900, 150, 'sine');
        }, 100);
    }
    
    /**
     * 地主确定音效
     */
    landlord() {
        // 胜利音阶
        const notes = [523, 659, 784]; // C E G
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 200, 'sine');
            }, i * 150);
        });
    }
    
    /**
     * 胜利音效
     */
    win() {
        // 上升音阶
        const notes = [523, 659, 784, 1047]; // C E G C
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 300, 'sine');
            }, i * 200);
        });
    }
    
    /**
     * 失败音效
     */
    lose() {
        // 下降音阶
        const notes = [523, 392, 330]; // C G E
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 400, 'triangle');
            }, i * 200);
        });
    }
    
    /**
     * 提示音效
     */
    hint() {
        this.playTone(1000, 100, 'sine');
    }
    
    /**
     * 警告音效
     */
    warning() {
        this.playTone(400, 150, 'square');
        setTimeout(() => {
            this.playTone(400, 150, 'square');
        }, 200);
    }
    
    /**
     * 倒计时音效
     */
    timer() {
        this.playTone(600, 100, 'sine');
    }
    
    /**
     * 设置音量
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * 启用/禁用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

// 创建全局实例
window.TempSoundGenerator = new TempSoundGenerator();

console.log('✅ TempSoundGenerator loaded');
