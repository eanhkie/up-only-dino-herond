import Phaser from 'phaser'
import { screenSize } from '../gameConfig.json'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' })
  }

  preload() {
    // All assets are already loaded by PreloaderScene
    // No need to load anything here
  }

  create() {
    // Create notebook style background
    const screenWidth = screenSize.width.value
    const screenHeight = screenSize.height.value
    
    // Create tiled background to cover entire screen
    const bgWidth = 1024
    const bgHeight = 1536
    const tilesX = Math.ceil(screenWidth / bgWidth) + 1
    const tilesY = Math.ceil(screenHeight / bgHeight) + 1
    
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const bg = this.add.image(x * bgWidth, y * bgHeight, "refined_notebook_title_background")
        bg.setOrigin(0, 0)
        bg.setDepth(-100)
      }
    }

    this.createUI()
    this.setupInputs()
  }

  createUI() {
    const screenWidth = screenSize.width.value
    const screenHeight = screenSize.height.value
    
    // Add dinosaur image to title screen with floating animation
    const dinoImage = this.add.image(screenWidth / 2, screenHeight * 0.2, 'trex_idle')
    dinoImage.setScale(0.15) // Scale to fit nicely
    dinoImage.setOrigin(0.5, 0.5)
    
    // Add floating animation to dinosaur
    this.tweens.add({
      targets: dinoImage,
      y: screenHeight * 0.2 - 10,
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    })
    
    // Create colorful title "UP ONLY DINO" with different colors for each letter
    this.createColorfulTitle(screenWidth, screenHeight)

    // Create instruction text (without TAP TO START)
    // this.createInstructionText() // Removed TAP TO START
    this.createControlsText()
  }

  createColorfulTitle(screenWidth, screenHeight) {
    const titleText = 'UP ONLY DINO'
    const baseX = screenWidth / 2
    const baseY = screenHeight * 0.35
    
    // Color scheme matching the original colorful style
    // U-P-_-O-N-L-Y-_-D-I-N-O
    const colorMap = {
      'U': '#ff0000', // Red
      'P': '#ffaa00', // Orange/Yellow
      ' ': null,      // Space
      'O': '#00ff00', // Green
      'N': '#00aaff', // Blue
      'L': '#ff00ff', // Magenta/Pink
      'Y': '#ff0000', // Red
      'D': '#ffaa00', // Orange/Yellow
      'I': '#00aaff'  // Blue
    }
    
    // Calculate spacing first
    const letterSpacing = 35 // Fixed spacing between letters
    const spaceSpacing = 50 // Fixed spacing for spaces between words
    
    // Calculate total width to determine if we need to adjust font size
    let totalWidth = 0
    for (let i = 0; i < titleText.length; i++) {
      if (titleText[i] === ' ') {
        totalWidth += spaceSpacing
      } else {
        totalWidth += letterSpacing
      }
    }
    
    // Adjust font size to fit screen width (leave 10% margin on each side)
    const maxWidth = screenWidth * 0.9
    let fontSize = Math.min(screenWidth / 6, 48)
    if (totalWidth > maxWidth) {
      fontSize = (maxWidth / totalWidth) * fontSize
    }
    
    // Recalculate spacing based on adjusted font size to maintain proportions
    const adjustedLetterSpacing = (letterSpacing / 48) * fontSize
    const adjustedSpaceSpacing = (spaceSpacing / 48) * fontSize
    
    // Create each letter with different color
    let xOffset = 0 // Start from center, will adjust later
    const letters = []
    
    for (let i = 0; i < titleText.length; i++) {
      const char = titleText[i]
      if (char === ' ') {
        xOffset += adjustedSpaceSpacing
        continue
      }
      
      const color = colorMap[char] || '#333333'
      const letter = this.add.text(baseX + xOffset, baseY, char, {
        fontFamily: 'SupercellMagic',
        fontSize: fontSize + 'px',
        fill: color,
        stroke: '#000000',
        strokeThickness: 6,
        fontWeight: 'bold'
      }).setOrigin(0.5, 0.5)
      
      letters.push(letter)
      xOffset += adjustedLetterSpacing
    }
    
    // Calculate actual bounds of all letters to center properly
    if (letters.length > 0) {
      let minX = Infinity
      let maxX = -Infinity
      
      letters.forEach(letter => {
        const bounds = letter.getBounds()
        minX = Math.min(minX, bounds.left)
        maxX = Math.max(maxX, bounds.right)
      })
      
      const actualWidth = maxX - minX
      const centerOffset = (screenWidth / 2) - ((minX + maxX) / 2)
      
      // Reposition all letters to be perfectly centered
      letters.forEach(letter => {
        letter.x += centerOffset
      })
    }
    
    // Add subtle bounce animation to letters
    letters.forEach((letter, index) => {
      this.tweens.add({
        targets: letter,
        y: baseY - 5,
        duration: 1000 + (index * 100),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: index * 50
      })
    })
  }

  // Removed createInstructionText() - no longer showing "TAP TO START"

  createControlsText() {
    const screenWidth = screenSize.width.value
    const screenHeight = screenSize.height.value
    
    // Create control instruction text (moved up since TAP TO START is removed)
    const controlsText = `
← → : Move left/right
SPACE : Shoot
TAP LEFT/RIGHT : Move

Jump on platforms to go higher!
Avoid enemies or shoot them!
Collect power-ups for special abilities!
    `.trim()

    this.controlsDisplay = this.add.text(screenWidth / 2, screenHeight * 0.7, controlsText, {
      fontFamily: 'SupercellMagic',
      fontSize: Math.min(screenWidth / 25, 14) + 'px',
      fill: '#666666',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5, 0.5)
  }

  setupInputs() {
    // Listen for click/touch events
    this.input.on('pointerdown', () => {
      this.startGame()
    })

    // Listen for keyboard events
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.enterKey.on('down', () => {
      this.startGame()
    })

    this.spaceKey.on('down', () => {
      this.startGame()
    })
  }

  startGame() {
    // Play click sound effect
    this.sound.add("ui_click", { volume: 0.3 }).play()
    
    // Start game
    this.scene.start('GameScene')
  }
}