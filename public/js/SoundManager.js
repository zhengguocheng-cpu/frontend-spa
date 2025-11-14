/**
 * 音效管理器
 * 负责管理游戏中的所有音效和背景音乐
 * 创建时间：2025-10-29
 */

class SoundManager {
    constructor() {
        // 当前实际存在的音频资源（如需新增，请在 public/sounds 下添加文件并更新此列表）
        this.availableSoundFiles = new Set([
            '/sounds/background.wav',
            '/sounds/jiaodizhu.mp3',
            '/sounds/zhadan.mp3'
        ]);

        // 音效文件路径（使用免费音效库）
        this.sounds = {
            // 基础音效
            click: this.createOptionalAudio('/sounds/click.mp3', 'click'),
            deal: this.createOptionalAudio('/sounds/deal.mp3', 'deal'),
            play: this.createOptionalAudio('/sounds/play.mp3', 'play'),
            pass: this.createOptionalAudio('/sounds/pass.mp3', 'pass'),
            
            // 特殊牌型音效
            bomb: this.createOptionalAudio('/sounds/zhadan.mp3', 'bomb'),  // 使用真实炸弹音效
            rocket: this.createOptionalAudio('/sounds/rocket.mp3', 'rocket'),
            plane: this.createOptionalAudio('/sounds/plane.mp3', 'plane'),
            
            // 游戏事件音效
            bid: this.createOptionalAudio('/sounds/jiaodizhu.mp3', 'bid'),  // 使用真实抢地主音效
            landlord: this.createOptionalAudio('/sounds/landlord.mp3', 'landlord'),
            win: this.createOptionalAudio('/sounds/win.mp3', 'win'),
            lose: this.createOptionalAudio('/sounds/lose.mp3', 'lose'),
            
            // 提示音效
            hint: this.createOptionalAudio('/sounds/hint.mp3', 'hint'),
            warning: this.createOptionalAudio('/sounds/warning.mp3', 'warning'),
            timer: this.createOptionalAudio('/sounds/timer.mp3', 'timer')
        };
        
        // 背景音乐
        this.bgMusic = {
            lobby: this.createOptionalAudio('/sounds/background.wav', 'background', true),
            game: this.createOptionalAudio('/sounds/background.wav', 'background', true)
        };
        
        // 音量设置
        this.volume = this.loadVolume();
        this.musicVolume = this.loadMusicVolume();
        this.enabled = this.loadEnabled();
        this.musicEnabled = this.loadMusicEnabled();
        
        // 当前播放的背景音乐
        this.currentBgMusic = null;
        
        console.log('🔊 SoundManager initialized');
    }
    
    /**
     * 尝试创建音频对象，若资源缺失则返回 null 并提醒使用临时音效
     */
    createOptionalAudio(path, soundName, loop = false) {
        if (!this.availableSoundFiles.has(path)) {
            console.warn(`ℹ️ 音效文件缺失: ${path}，将使用临时音效生成器 (${soundName})`);
            return null;
        }
        return this.createAudio(path, loop);
    }

    /**
     * 创建音频对象
     */
    createAudio(src, loop = false) {
        const audio = new Audio();
        audio.src = src;
        audio.loop = loop;
        audio.preload = 'auto';
        
        // 错误处理
        audio.addEventListener('error', (e) => {
            console.warn(`⚠️ 音频加载失败: ${src}`, e);
        });
        
        return audio;
    }
    
    /**
     * 播放音效
     */
    play(soundName) {
        if (!this.enabled) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            this.playTempSound(soundName);
            return;
        }
        
        // 播放音效时降低背景音乐音量
        this.duckBackgroundMusic();
        
        try {
            sound.volume = this.volume;
            sound.currentTime = 0; // 重置播放位置
            
            // 音效播放完成后恢复背景音乐音量
            sound.onended = () => {
                this.restoreBackgroundMusic();
            };
            
            sound.play().catch(err => {
                // 如果音效文件加载失败，使用临时音效生成器
                console.warn(`⚠️ 音效播放失败，使用临时音效: ${soundName}`, err);
                this.playTempSound(soundName);
                this.restoreBackgroundMusic();
            });
        } catch (err) {
            console.warn(`⚠️ 音效播放异常，使用临时音效: ${soundName}`, err);
            this.playTempSound(soundName);
            this.restoreBackgroundMusic();
        }
    }
    
    /**
     * 使用临时音效生成器
     */
    playTempSound(soundName) {
        if (window.TempSoundGenerator && typeof window.TempSoundGenerator[soundName] === 'function') {
            window.TempSoundGenerator[soundName]();
        }
    }
    
    /**
     * 播放背景音乐
     */
    playBgMusic(musicName) {
        if (!this.musicEnabled) return;
        
        const music = this.bgMusic[musicName];
        if (!music) {
            console.warn(`⚠️ 背景音乐不存在: ${musicName}`);
            return;
        }
        
        // 停止当前音乐
        this.stopBgMusic();
        
        try {
            music.volume = this.musicVolume;
            music.play().catch(err => {
                console.warn(`⚠️ 背景音乐播放失败: ${musicName}`, err);
            });
            this.currentBgMusic = music;
        } catch (err) {
            console.warn(`⚠️ 背景音乐播放异常: ${musicName}`, err);
        }
    }
    
    /**
     * 停止背景音乐
     */
    stopBgMusic() {
        if (this.currentBgMusic) {
            this.currentBgMusic.pause();
            this.currentBgMusic.currentTime = 0;
            this.currentBgMusic = null;
        }
    }
    
    /**
     * 降低背景音乐音量（音效播放时）
     */
    duckBackgroundMusic() {
        if (this.currentBgMusic && this.musicEnabled) {
            // 降低到原音量的20%
            this.currentBgMusic.volume = this.musicVolume * 0.2;
        }
    }
    
    /**
     * 恢复背景音乐音量
     */
    restoreBackgroundMusic() {
        if (this.currentBgMusic && this.musicEnabled) {
            // 恢复到原音量
            this.currentBgMusic.volume = this.musicVolume;
        }
    }
    
    /**
     * 设置音效音量
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.saveVolume();
        
        // 更新所有音效的音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }
    
    /**
     * 设置背景音乐音量
     */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.saveMusicVolume();
        
        // 更新所有背景音乐的音量
        Object.values(this.bgMusic).forEach(music => {
            music.volume = this.musicVolume;
        });
        
        if (this.currentBgMusic) {
            this.currentBgMusic.volume = this.musicVolume;
        }
    }
    
    /**
     * 启用/禁用音效
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.saveEnabled();
        
        if (!enabled) {
            // 停止所有正在播放的音效
            Object.values(this.sounds).forEach(sound => {
                sound.pause();
                sound.currentTime = 0;
            });
        }
    }
    
    /**
     * 启用/禁用背景音乐
     */
    setMusicEnabled(enabled) {
        this.musicEnabled = enabled;
        this.saveMusicEnabled();
        
        if (!enabled) {
            this.stopBgMusic();
        }
    }
    
    /**
     * 切换音效开关
     */
    toggleSound() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }
    
    /**
     * 切换音乐开关
     */
    toggleMusic() {
        this.setMusicEnabled(!this.musicEnabled);
        return this.musicEnabled;
    }
    
    // ==================== 本地存储 ====================
    
    loadVolume() {
        const saved = localStorage.getItem('soundVolume');
        return saved ? parseFloat(saved) : 0.5;
    }
    
    saveVolume() {
        localStorage.setItem('soundVolume', this.volume.toString());
    }
    
    loadMusicVolume() {
        const saved = localStorage.getItem('musicVolume');
        return saved ? parseFloat(saved) : 0.3;
    }
    
    saveMusicVolume() {
        localStorage.setItem('musicVolume', this.musicVolume.toString());
    }
    
    loadEnabled() {
        const saved = localStorage.getItem('soundEnabled');
        return saved === null ? true : saved === 'true';
    }
    
    saveEnabled() {
        localStorage.setItem('soundEnabled', this.enabled.toString());
    }
    
    loadMusicEnabled() {
        const saved = localStorage.getItem('musicEnabled');
        return saved === null ? true : saved === 'true';
    }
    
    saveMusicEnabled() {
        localStorage.setItem('musicEnabled', this.musicEnabled.toString());
    }
    
    // ==================== 便捷方法 ====================
    
    /**
     * 播放点击音效
     */
    playClick() {
        this.play('click');
    }
    
    /**
     * 播放发牌音效
     */
    playDeal() {
        this.play('deal');
    }
    
    /**
     * 播放出牌音效（根据牌型）
     */
    playCardType(cardType) {
        if (!cardType) {
            this.play('play');
            return;
        }
        
        switch (cardType.type) {
            case 'bomb':
            case 'BOMB':
                this.play('bomb');
                break;
            case 'rocket':
            case 'ROCKET':
                this.play('rocket');
                break;
            case 'airplane':
            case 'airplane_with_wings':
            case 'PLANE':
            case 'PLANE_PLUS_WINGS':
                this.play('plane');
                break;
            default:
                this.play('play');
        }
    }
    
    /**
     * 播放不出音效
     */
    playPass() {
        this.play('pass');
    }
    
    /**
     * 播放抢地主音效
     */
    playBid() {
        console.log('🔊 [SoundManager] playBid() 被调用');
        console.log('🔊 [SoundManager] enabled:', this.enabled);
        console.log('🔊 [SoundManager] bid音效对象:', this.sounds.bid);
        this.play('bid');
    }
    
    /**
     * 播放地主确定音效
     */
    playLandlord() {
        this.play('landlord');
    }
    
    /**
     * 播放胜利音效
     */
    playWin() {
        this.play('win');
    }
    
    /**
     * 播放失败音效
     */
    playLose() {
        this.play('lose');
    }
    
    /**
     * 播放提示音效
     */
    playHint() {
        this.play('hint');
    }
    
    /**
     * 播放警告音效
     */
    playWarning() {
        this.play('warning');
    }
    
    /**
     * 播放倒计时音效
     */
    playTimer() {
        this.play('timer');
    }
}

// 创建全局单例
window.SoundManager = new SoundManager();

console.log('✅ SoundManager loaded and ready');
