import Phaser from 'phaser'
import { Player } from '../Player.js'
import { Platform } from '../Platform.js'
import { Enemy } from '../Enemy.js'
import { Powerup } from '../Powerup.js'
import { screenSize, platformConfig, enemyConfig, powerupConfig, gameConfig } from '../gameConfig.json'

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    // All assets are already loaded by PreloaderScene
    // No need to load anything here
  }

  create() {
    // Initialize game state
    this.gameStarted = false
    this.gameOver = false
    this.score = 0
    this.highestY = 0 // Highest height ever reached
    this.currentHeight = 0 // Current height (can decrease when falling)
    this.comboCount = 0
    this.lastEnemyKillTime = 0
    this.comboTimeout = 2000 // 2 seconds to maintain combo

    // Create detailed notebook style background
    this.createNotebookBackground()

    // Create physics groups
    this.platforms = this.add.group()
    this.enemies = this.add.group()
    this.powerups = this.add.group()
    this.bullets = this.add.group()

    // Create player
    this.player = new Player(this, screenSize.width.value / 2, screenSize.height.value - 100)
    
    // Store initial player Y position for height calculation
    this.initialPlayerY = screenSize.height.value - 100
    
    // Store starting platform Y position (bậc ban đầu)
    this.startingPlatformY = screenSize.height.value - 50

    // Create initial platforms
    this.createInitialPlatforms()

    // Setup camera follow with better smoothing
    // Follow player both up and down, but with different deadzones
    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
    this.cameras.main.setLerp(0.15, 0.15)
    // Deadzone: follow immediately when falling, but allow some space when going up
    this.cameras.main.setDeadzone(50, 50) // Smaller deadzone to follow better when falling
    // Set follow offset to keep player in upper part of screen
    this.cameras.main.setFollowOffset(0, -150) // Offset to keep player higher on screen
    // Set camera bounds - allow camera to follow player when falling down
    // No upper bound, but allow camera to scroll down when player falls
    this.cameras.main.setBounds(0, -10000, screenSize.width.value, 20000)
    // Ensure camera always follows player (no bounds restriction on Y)
    this.cameras.main.setScroll(0, 0)

    // Create input controls
    this.setupInputs()

    // Setup collision detection
    this.setupCollisions()

    // Initialize bullet pool for performance
    this.bulletPool = []
    this.maxBullets = 20
    this.activeBullets = 0

    // Launch UI scene
    this.scene.launch("UIScene", { gameSceneKey: this.scene.key })

    // Platform generation related
    this.lastPlatformY = screenSize.height.value - 100
    this.platformSpacing = platformConfig.platformSpacing.value

    // Play background music - Trăng Hoa Mây Mưa (Rap Việt)
    // Thêm error handling để tránh game bị đứng nếu nhạc không load được
    this.backgroundMusic = null
    try {
      // Kiểm tra xem audio có tồn tại trong cache không
      if (this.cache.audio.exists("trang_hoa_may_mua")) {
        this.backgroundMusic = this.sound.add("trang_hoa_may_mua", {
          volume: 0.4, // Volume cho nhạc rap (có thể điều chỉnh 0.0 - 1.0)
          loop: true
        })
        
        // Không play ngay lập tức - chờ user interaction (browser autoplay policy)
        // Nhạc sẽ được play trong setupInputs() khi user tương tác lần đầu
      } else {
        // Fallback nếu file nhạc không tồn tại
        console.warn("Background music file not found, using fallback")
        if (this.cache.audio.exists("gentle_background_ambient")) {
          this.backgroundMusic = this.sound.add("gentle_background_ambient", {
            volume: 0.15,
            loop: true
          })
          // Cũng không play ngay, chờ user interaction
        }
      }
    } catch (error) {
      console.error("Error loading background music:", error)
      // Game vẫn chạy bình thường dù không có nhạc
      this.backgroundMusic = null
    }

    // Start game
    this.startGame()
  }

  createInitialPlatforms() {
    // Create initial platform under player
    const startPlatform = new Platform(this, screenSize.width.value / 2, screenSize.height.value - 50, 'normal')
    this.platforms.add(startPlatform)

    // Create some initial platforms
    for (let i = 1; i <= 5; i++) {
      const x = Phaser.Math.Between(60, screenSize.width.value - 60)
      const y = screenSize.height.value - 50 - (i * this.platformSpacing)
      const type = Platform.getRandomPlatformType()
      const platform = new Platform(this, x, y, type)
      this.platforms.add(platform)
    }
  }

  setupInputs() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    
    // Track if user has interacted (for audio autoplay policy)
    this.userHasInteracted = false

    // Add touch controls
    this.input.on('pointerdown', (pointer) => {
      // Start music on first user interaction (browser autoplay policy)
      if (!this.userHasInteracted && this.backgroundMusic && !this.backgroundMusic.isPlaying) {
        this.userHasInteracted = true
        try {
          this.backgroundMusic.play()
        } catch (error) {
          console.warn("Cannot play music on user interaction:", error)
        }
      }
      
      if (!this.gameStarted || this.gameOver) return

      // Move player based on touch position
      if (pointer.x < screenSize.width.value / 2) {
        this.cursors.left.isDown = true
        this.cursors.right.isDown = false
      } else {
        this.cursors.right.isDown = true
        this.cursors.left.isDown = false
      }

      // Touch can also shoot
      this.spaceKey.isDown = true
    })

    this.input.on('pointerup', () => {
      this.cursors.left.isDown = false
      this.cursors.right.isDown = false
      this.spaceKey.isDown = false
    })
    
    // Also listen for keyboard input to start music
    this.input.keyboard.on('keydown', () => {
      if (!this.userHasInteracted && this.backgroundMusic && !this.backgroundMusic.isPlaying) {
        this.userHasInteracted = true
        try {
          this.backgroundMusic.play()
        } catch (error) {
          console.warn("Cannot play music on keyboard input:", error)
        }
      }
    })
  }

  setupCollisions() {
    // Player-platform collision - only triggered when player is falling
    this.physics.add.overlap(this.player, this.platforms, (player, platform) => {
      if (player.body.velocity.y > 0 && player.y < platform.y) {
        platform.onPlayerLand(player)
      }
    })

    // Player-enemy collision - stomp or collision
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      // Prevent multiple calls and check if game already over
      if (this.gameOver || !player || !enemy || !player.active || !enemy.active) {
        return
      }
      
      // Check if enemy is already dead
      if (enemy.isDead) {
        return
      }
      
      if (player.body.velocity.y > 0 && player.y < enemy.y) {
        // Player stomps enemy
        if (enemy.stepOn && enemy.stepOn()) {
          player.jump() // Bounce after stomp
          this.addCombo()
          this.updateScore(100 * this.getComboMultiplier()) // Gain score with combo
          this.createParticleEffect(enemy.x, enemy.y, 0xff0000) // Red particles for enemy defeat
          this.screenShake(100) // Screen shake on enemy defeat
        }
      } else {
        // Player hits enemy, game over
        // Set gameOver first to prevent multiple calls
        this.gameOver = true
        
        // Delay clearCache to avoid destroying objects during collision callback
        this.time.delayedCall(100, () => {
          if (this.clearCache) {
            this.clearCache()
          }
        })
        
        // Call die() which will launch GameOverScene
        if (player.die) {
          player.die()
        }
      }
    })

    // Player-power-up collision
    this.physics.add.overlap(this.player, this.powerups, (player, powerup) => {
      if (powerup.collect(player)) {
        this.updateScore(200) // Gain score for collecting power-up
        this.createPowerupCollectionEffect(powerup.x, powerup.y, powerup.powerupType)
      }
    })

    // Bullet-enemy collision
    this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
      if (enemy.hitByBullet()) {
        this.returnBulletToPool(bullet)
        this.addCombo()
        this.updateScore(150 * this.getComboMultiplier()) // Gain score with combo
        this.createParticleEffect(enemy.x, enemy.y, 0xff6600) // Orange particles for bullet hit
        this.screenShake(50) // Light screen shake on bullet hit
      }
    })
  }


  startGame() {
    this.gameStarted = true
    // Give player initial upward velocity
    this.player.jump()
  }

  update() {
    if (!this.gameStarted || this.gameOver) return

    // Update camera follow behavior - always follow player when falling
    const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height
    if (this.player.body.velocity.y > 0 && this.player.y > this.cameras.main.scrollY + this.cameras.main.height * 0.6) {
      // Player is falling and below 60% of screen - make camera follow immediately
      this.cameras.main.setDeadzone(50, 0) // No deadzone when falling
      // Force camera to follow player when falling - keep player in upper 40% of screen
      const targetY = this.player.y - this.cameras.main.height * 0.4
      if (this.cameras.main.scrollY < targetY) {
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.4)
      }
    } else {
      // Player is going up or in safe zone - allow some deadzone
      this.cameras.main.setDeadzone(50, 50)
    }

    // Update player
    this.player.update(this.cursors, this.spaceKey)

    // Update platforms
    this.platforms.children.entries.forEach(platform => {
      if (platform.update) platform.update()
    })

    // Update enemies
    this.enemies.children.entries.forEach(enemy => {
      if (enemy.update) enemy.update()
    })

    // Update power-ups
    this.powerups.children.entries.forEach(powerup => {
      if (powerup.update) powerup.update()
    })

    // Generate new platforms
    this.generateNewPlatforms()

    // Update background
    this.updateBackground()

    // Update score and height
    this.updateHeight()
    this.updateUI()
    this.updateCombo()

    // Clean up objects off screen
    this.cleanupOffScreenObjects()
  }

  // Combo system
  addCombo() {
    const currentTime = this.time.now
    if (currentTime - this.lastEnemyKillTime < this.comboTimeout) {
      this.comboCount++
    } else {
      this.comboCount = 1
    }
    this.lastEnemyKillTime = currentTime
  }

  updateCombo() {
    const currentTime = this.time.now
    if (currentTime - this.lastEnemyKillTime > this.comboTimeout && this.comboCount > 0) {
      this.comboCount = 0
    }
  }

  getComboMultiplier() {
    if (this.comboCount <= 1) return 1
    return Math.min(1 + (this.comboCount * 0.2), 3) // Max 3x multiplier
  }

  // Particle effects
  createParticleEffect(x, y, color) {
    const particles = this.add.particles(x, y, 'ultra_tiny_bullet_dot', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.1, end: 0 },
      tint: color,
      lifespan: 500,
      quantity: 8
    })
    
    this.time.delayedCall(500, () => {
      particles.destroy()
    })
  }

  // Enhanced power-up collection effect
  createPowerupCollectionEffect(x, y, powerupType) {
    // Get color and name based on power-up type
    let color, name
    switch(powerupType) {
      case 'jetpack':
        color = 0x00aaff // Blue
        name = 'JETPACK!'
        break
      case 'spring_shoes':
        color = 0xffaa00 // Orange
        name = 'SPRING SHOES!'
        break
      case 'propeller_hat':
        color = 0x00ffaa // Cyan
        name = 'PROPELLER HAT!'
        break
      default:
        color = 0x00ff00 // Green
        name = 'POWER-UP!'
    }

    // Create enhanced particle effect with multiple layers - more intense for better visibility
    const mainParticles = this.add.particles(x, y, 'ultra_tiny_bullet_dot', {
      speed: { min: 150, max: 300 },
      scale: { start: 0.2, end: 0 },
      tint: color,
      lifespan: 1000,
      quantity: 30, // Increased quantity for better visibility
      angle: { min: 0, max: 360 }
    })

    // Create sparkle particles - more visible
    const sparkleParticles = this.add.particles(x, y, 'ultra_tiny_bullet_dot', {
      speed: { min: 80, max: 150 },
      scale: { start: 0.25, end: 0 },
      tint: 0xffffff,
      lifespan: 800,
      quantity: 20, // Increased quantity
      angle: { min: 0, max: 360 }
    })
    
    // Add colored sparkle particles matching power-up color
    const colorSparkles = this.add.particles(x, y, 'ultra_tiny_bullet_dot', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.18, end: 0 },
      tint: color,
      lifespan: 700,
      quantity: 15,
      angle: { min: 0, max: 360 }
    })

    // Create expanding ring effect - more visible
    const ring = this.add.circle(x, y, 20, color, 0.8)
    ring.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: ring,
      radius: 200,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        ring.destroy()
      }
    })
    
    // Add second ring for extra effect
    const ring2 = this.add.circle(x, y, 15, color, 0.6)
    ring2.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: ring2,
      radius: 180,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      delay: 100,
      onComplete: () => {
        ring2.destroy()
      }
    })

    // Create star burst effect - more stars for better visibility
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180
      const star = this.add.circle(x, y, 10, color, 0.9)
      star.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 150,
        y: y + Math.sin(angle) * 150,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Power2',
        delay: i * 25,
        onComplete: () => {
          star.destroy()
        }
      })
    }

    // Create text popup with enhanced effect - larger and more visible
    const popupText = this.add.text(x, y - 30, name, {
      fontFamily: 'SupercellMagic',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 10,
      align: 'center',
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: color,
        blur: 15,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5, 0.5).setDepth(200)

    // Animate text popup with rotation
    this.tweens.add({
      targets: popupText,
      y: y - 100,
      alpha: 0,
      scale: 1.8,
      rotation: Math.PI * 0.2,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => {
        popupText.destroy()
      }
    })

    // Create glow effect around player
    this.createPlayerGlowEffect(color)

    // Screen flash effect
    this.createScreenFlash(color, 0.4)

    // Player bounce animation with rotation
    this.tweens.add({
      targets: this.player,
      scaleX: this.player.scaleX * 1.3,
      scaleY: this.player.scaleY * 1.3,
      rotation: Math.PI * 0.1,
      duration: 200,
      yoyo: true,
      ease: 'Power2'
    })

    // Clean up particles
    this.time.delayedCall(1000, () => {
      mainParticles.destroy()
      sparkleParticles.destroy()
      colorSparkles.destroy()
    })
  }

  // Create glow effect around player
  createPlayerGlowEffect(color) {
    // Create a glow sprite (circular) at player position
    const playerX = this.player.x
    const playerY = this.player.y
    const glow = this.add.circle(playerX, playerY, 60, color, 0.4)
    glow.setDepth(this.player.depth - 1)
    glow.setBlendMode(Phaser.BlendModes.ADD)
    glow.setScrollFactor(1, 1) // Follow camera

    // Animate glow expanding and fading
    this.tweens.add({
      targets: glow,
      scaleX: 2.0,
      scaleY: 2.0,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onUpdate: () => {
        // Keep glow centered on player
        glow.x = this.player.x
        glow.y = this.player.y
      },
      onComplete: () => {
        glow.destroy()
      }
    })
  }

  // Create screen flash effect
  createScreenFlash(color, intensity = 0.2) {
    const flash = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      color,
      intensity
    )
    flash.setScrollFactor(0)
    flash.setDepth(1000)
    flash.setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy()
      }
    })
  }

  // Screen shake effect
  screenShake(intensity = 100) {
    this.cameras.main.shake(200, intensity / 1000)
  }

  createNotebookBackground() {
    // Initialize background management
    this.backgroundTiles = []
    this.lastBackgroundY = 0
    
    // Create initial background
    this.generateInitialBackground()
  }

  generateInitialBackground() {
    const bgWidth = 1024
    const bgHeight = 1536
    const screenWidth = screenSize.width.value
    const screenHeight = screenSize.height.value
    
    // Calculate how many backgrounds needed to cover screen
    const tilesX = Math.ceil(screenWidth / bgWidth) + 1
    const tilesY = Math.ceil((screenHeight * 2) / bgHeight) + 2
    
    for (let x = 0; x < tilesX; x++) {
      for (let y = -tilesY; y < 2; y++) {
        const bg = this.add.image(x * bgWidth, y * bgHeight, "refined_notebook_grid_background")
        bg.setOrigin(0, 0)
        bg.setDepth(-100)
        bg.setScrollFactor(1, 1)
        this.backgroundTiles.push(bg)
      }
    }
    this.lastBackgroundY = -tilesY * bgHeight
  }

  updateBackground() {
    const cameraTop = this.cameras.main.scrollY
    const playerY = this.player.y
    const bgHeight = 1536
    const screenWidth = screenSize.width.value
    const bgWidth = 1024
    
    // If camera moves up, generate new background
    if (cameraTop < this.lastBackgroundY + bgHeight * 2) {
      const tilesX = Math.ceil(screenWidth / bgWidth) + 1
      
      // Generate a new row of background
      for (let x = 0; x < tilesX; x++) {
        const bg = this.add.image(x * bgWidth, this.lastBackgroundY - bgHeight, "refined_notebook_grid_background")
        bg.setOrigin(0, 0)
        bg.setDepth(-100)
        bg.setScrollFactor(1, 1)
        this.backgroundTiles.push(bg)
      }
      this.lastBackgroundY -= bgHeight
    }
    
    // Cache all backgrounds above player - only remove if too far below player
    // Keep all backgrounds that player has passed (above player)
    const maxYBelow = playerY + 2000 // Only remove if more than 2000 pixels below player
    this.backgroundTiles = this.backgroundTiles.filter(bg => {
      // Keep all backgrounds above player (bg.y < playerY means above)
      // Only remove if too far below player
      if (bg.y > maxYBelow) {
        bg.destroy()
        return false
      }
      return true
    })
  }

  generateNewPlatforms() {
    const cameraTop = this.cameras.main.scrollY
    const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height
    const generateThreshold = cameraTop - 200

    // Dynamic difficulty scaling - increase enemy spawn chance and reduce platform spacing at higher heights
    const difficultyMultiplier = Math.min(1 + (this.highestY / 1000), 2) // Max 2x difficulty
    const adjustedEnemyChance = Math.min(enemyConfig.spawnChance.value * difficultyMultiplier, 20) // Cap at 20%
    const adjustedPlatformSpacing = Math.max(platformConfig.platformSpacing.value - (this.highestY / 50), 50) // Min 50 spacing

    // Generate platforms below player if they're falling
    if (this.player.body.velocity.y > 0 && this.player.y > cameraBottom - 100) {
      // Player is falling and near bottom of screen - create platform below
      const belowPlatformY = cameraBottom + 100
      if (this.lastPlatformY < belowPlatformY - adjustedPlatformSpacing) {
        const x = Phaser.Math.Between(80, screenSize.width.value - 80)
        const type = Platform.getRandomPlatformType()
        const platform = new Platform(this, x, belowPlatformY, type)
        this.platforms.add(platform)
        this.lastPlatformY = belowPlatformY
      }
    }

    // If highest platform is below generation threshold, generate new platform
    if (this.lastPlatformY > generateThreshold) {
      let attempts = 0
      let validPosition = false
      let x, newY
      
      // Ensure new platform does not overlap
      while (!validPosition && attempts < 10) {
        this.lastPlatformY -= adjustedPlatformSpacing
        newY = this.lastPlatformY
        x = Phaser.Math.Between(80, screenSize.width.value - 80)
        
        // Check if overlaps with existing platforms
        const overlap = this.platforms.children.entries.some(platform => {
          if (!platform.active) return false
          const distance = Phaser.Math.Distance.Between(x, newY, platform.x, platform.y)
          return distance < 60 // Minimum distance check
        })
        
        if (!overlap) {
          validPosition = true
        }
        attempts++
      }
      
      if (validPosition) {
        const type = Platform.getRandomPlatformType()
        
        // Create platform
        const platform = new Platform(this, x, newY, type)
        this.platforms.add(platform)

        // May generate enemy - difficulty scales with height
        if (Phaser.Math.Between(1, 100) <= adjustedEnemyChance) {
          const enemyX = Phaser.Math.Between(80, screenSize.width.value - 80)
          const enemyY = newY - 80
          const enemy = new Enemy(this, enemyX, enemyY)
          this.enemies.add(enemy)
        }

        // May generate power-up
        const powerupType = Powerup.getRandomPowerupType()
        if (powerupType) {
          const powerupX = Phaser.Math.Between(80, screenSize.width.value - 80)
          const powerupY = newY - 60
          const powerup = new Powerup(this, powerupX, powerupY, powerupType)
          this.powerups.add(powerup)
        }
      }
    }
  }

  updateHeight() {
    // Calculate current height: positive when going up, 0 at start, can be negative when below start
    const heightDifference = this.initialPlayerY - this.player.y
    this.currentHeight = Math.floor(heightDifference / 10) // Allow negative values
    
    // Game over only when player falls BELOW the starting platform (bậc ban đầu)
    // Player origin is at bottom (0.5, 1.0), so player.y is the bottom position
    // Starting platform center is at startingPlatformY, need to check if player bottom is below platform center
    // Add small buffer to account for platform visual height
    const platformBuffer = 40 // Buffer to account for platform visual appearance
    
    if (this.player.y > this.startingPlatformY + platformBuffer && this.player.body.velocity.y > 0 && !this.gameOver) {
      // Player has fallen below the starting platform
      // Only trigger if player is actually falling (not bouncing up)
      this.gameOver = true
      
      // Delay clearCache to avoid destroying objects during update loop
      this.time.delayedCall(100, () => {
        if (this.clearCache) {
          this.clearCache()
        }
      })
      
      // Call die() which will launch GameOverScene
      if (this.player && this.player.die) {
        this.player.die()
      }
      return
    }
    
    // Update highest height reached (only when going higher)
    if (this.currentHeight > this.highestY) {
      this.highestY = this.currentHeight
      this.updateScore(gameConfig.scoreMultiplier.value) // Gain score for reaching new height
    }
  }

  updateScore(points) {
    this.score += points
  }

  // Save high score to localStorage
  saveHighScore() {
    const highScore = this.getHighScore()
    if (this.score > highScore) {
      localStorage.setItem('doodleJumpHighScore', this.score.toString())
      localStorage.setItem('doodleJumpHighHeight', this.highestY.toString())
    }
  }

  // Get high score from localStorage
  getHighScore() {
    const saved = localStorage.getItem('doodleJumpHighScore')
    return saved ? parseInt(saved, 10) : 0
  }

  getHighHeight() {
    const saved = localStorage.getItem('doodleJumpHighHeight')
    return saved ? parseInt(saved, 10) : 0
  }

  // Bullet pooling for performance
  getBulletFromPool() {
    if (this.bulletPool.length > 0) {
      return this.bulletPool.pop()
    }
    return null
  }

  returnBulletToPool(bullet) {
    if (bullet && this.bulletPool.length < this.maxBullets) {
      bullet.setActive(false)
      bullet.setVisible(false)
      bullet.body.setVelocity(0, 0)
      this.bullets.remove(bullet)
      this.bulletPool.push(bullet)
    } else if (bullet) {
      bullet.destroy()
    }
  }

  updateUI() {
    // Send events to UIScene
    this.events.emit('updateScore', this.score)
    // Send current height (can decrease when falling), not highest
    this.events.emit('updateHeight', Math.max(0, this.currentHeight))
    this.events.emit('updateCombo', this.comboCount, this.getComboMultiplier())

    // Update power-ups status display
    let powerupStatus = ''
    if (this.player.hasPropellerHat) {
      powerupStatus += 'Propeller Hat Active\n'
    }
    if (this.player.hasJetpack) {
      powerupStatus += 'Jetpack Active\n'
    }
    if (this.player.hasSpringShoes) {
      powerupStatus += 'Spring Shoes Active'
    }
    this.events.emit('updatePowerupStatus', powerupStatus)
  }

  cleanupOffScreenObjects() {
    // DO NOT clean up platforms, enemies, or power-ups during gameplay
    // Cache persists until game over or restart
    // Only clean up temporary objects like bullets

    // Clean up bullets (return to pool instead of destroying)
    // Bullets can be cleaned up more aggressively since they're temporary
    const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height + 300
    this.bullets.children.entries.forEach(bullet => {
      if (bullet.y < this.cameras.main.scrollY - 100 || bullet.y > cameraBottom) {
        this.returnBulletToPool(bullet)
      }
    })
  }

  // Clear all cache when game over or restart
  clearCache() {
    // Only clear cache if game is over
    if (!this.gameOver) {
      return
    }
    
    // Destroy all platforms safely
    if (this.platforms && this.platforms.children) {
      const platforms = this.platforms.children.entries.slice() // Copy array to avoid modification during iteration
      platforms.forEach(platform => {
        if (platform && platform.active) {
          platform.destroy()
        }
      })
    }

    // Destroy all enemies safely
    if (this.enemies && this.enemies.children) {
      const enemies = this.enemies.children.entries.slice() // Copy array
      enemies.forEach(enemy => {
        if (enemy && enemy.active) {
          enemy.destroy()
        }
      })
    }

    // Destroy all power-ups safely
    if (this.powerups && this.powerups.children) {
      const powerups = this.powerups.children.entries.slice() // Copy array
      powerups.forEach(powerup => {
        if (powerup && powerup.active) {
          powerup.destroy()
        }
      })
    }

    // Destroy all bullets safely
    if (this.bullets && this.bullets.children) {
      const bullets = this.bullets.children.entries.slice() // Copy array
      bullets.forEach(bullet => {
        if (bullet && bullet.active) {
          bullet.destroy()
        }
      })
    }

    // Clear bullet pool
    this.bulletPool = []
    this.activeBullets = 0
  }
}
