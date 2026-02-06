import Phaser from 'phaser'
import { screenSize } from '../gameConfig.json'

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
  }

  init(data) {
    this.gameSceneKey = data.gameSceneKey
  }

  create() {
    // Get high score from localStorage
    const highScore = this.getHighScore()
    const highHeight = this.getHighHeight()

    // Create score display - ensure it's always visible (fixed to camera)
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontFamily: 'SupercellMagic',
      fontSize: '24px',
      color: '#000000',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(10000).setOrigin(0, 0)

    // Create height display - ensure it's always visible (fixed to camera)
    this.heightText = this.add.text(20, 50, 'Height: 0m', {
      fontFamily: 'SupercellMagic',
      fontSize: '20px',
      color: '#000000',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(10000).setOrigin(0, 0)

    // Create high score display - ensure it's always visible (fixed to camera)
    this.highScoreText = this.add.text(20, 80, `Best: ${highScore}`, {
      fontFamily: 'SupercellMagic',
      fontSize: '18px',
      color: '#ffaa00',
      stroke: '#ffffff',
      strokeThickness: 3
    }).setScrollFactor(0).setDepth(10000).setOrigin(0, 0)

    // Create combo display - ensure it's always visible (fixed to camera)
    this.comboText = this.add.text(screenSize.width.value / 2, 20, '', {
      fontFamily: 'SupercellMagic',
      fontSize: '28px',
      color: '#ff0000',
      stroke: '#ffffff',
      strokeThickness: 5
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10000)
    this.comboText.setVisible(false)

    // Create power-up status display - ensure it's always visible (fixed to camera)
    this.powerupText = this.add.text(screenSize.width.value - 20, 20, '', {
      fontFamily: 'SupercellMagic',
      fontSize: '16px',
      color: '#ff6600',
      stroke: '#ffffff',
      strokeThickness: 3
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10000)

    // Listen for game events from the game scene
    this.gameScene = this.scene.get(this.gameSceneKey)
    this.gameScene.events.on('updateScore', this.updateScore, this)
    this.gameScene.events.on('updateHeight', this.updateHeight, this)
    this.gameScene.events.on('updatePowerupStatus', this.updatePowerupStatus, this)
    this.gameScene.events.on('updateCombo', this.updateCombo, this)
  }

  getHighScore() {
    const saved = localStorage.getItem('doodleJumpHighScore')
    return saved ? parseInt(saved, 10) : 0
  }

  getHighHeight() {
    const saved = localStorage.getItem('doodleJumpHighHeight')
    return saved ? parseInt(saved, 10) : 0
  }

  updateScore(score) {
    this.scoreText.setText(`Score: ${score}`)
    // Update high score if needed
    const highScore = this.getHighScore()
    if (score > highScore) {
      this.highScoreText.setText(`Best: ${score}`)
      this.highScoreText.setColor('#00ff00') // Green when new record
      this.tweens.add({
        targets: this.highScoreText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true
      })
    }
  }

  updateHeight(height) {
    this.heightText.setText(`Height: ${height}m`)
  }

  updatePowerupStatus(powerupStatus) {
    this.powerupText.setText(powerupStatus)
  }

  updateCombo(comboCount, multiplier) {
    if (comboCount > 1) {
      this.comboText.setText(`${comboCount}x COMBO! (${multiplier.toFixed(1)}x)`)
      this.comboText.setVisible(true)
      // Add pulse animation
      this.tweens.add({
        targets: this.comboText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true,
        ease: 'Power2'
      })
    } else {
      this.comboText.setVisible(false)
    }
  }
}
