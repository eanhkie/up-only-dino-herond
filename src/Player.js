import Phaser from 'phaser'
import { playerConfig, gameConfig } from './gameConfig.json'

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "trex_idle")

    // Add to scene and physics system
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Character properties
    this.scene = scene
    this.facingDirection = "right"
    this.moveSpeed = playerConfig.moveSpeed.value
    this.jumpPower = playerConfig.jumpPower.value

    // Status flags
    this.isDead = false
    this.canShoot = true
    this.lastShootTime = 0
    this.shootCooldown = playerConfig.shootCooldown.value
    this.isShooting = false
    this.shootingDuration = 200 // Shooting animation duration

    // Power-up status
    this.hasJetpack = false
    this.jetpackStartTime = 0
    this.jetpackDuration = playerConfig.jetpackDuration.value
    this.jetpackPower = playerConfig.jetpackPower.value

    this.hasSpringShoes = false
    this.springShoesStartTime = 0
    this.springShoesDuration = playerConfig.springShoesDuration.value
    this.springShoesMultiplier = playerConfig.springShoesMultiplier.value

    this.hasPropellerHat = false
    this.propellerHatStartTime = 0
    this.propellerHatDuration = playerConfig.propellerHatDuration.value
    this.propellerHatPower = playerConfig.propellerHatPower.value

    // Current power-up animation state
    this.currentPowerupState = "normal" // "normal", "jetpack", "springshoes", "propellerhat"

    // Set physics properties
    this.body.setGravityY(gameConfig.gravity.value)

    // Set collision box based on T-Rex character (điều chỉnh cho khủng long mới)
    // Ảnh khủng long có kích thước 768x803 pixels
    // Collision box sẽ là khoảng 60-70% kích thước ảnh sau khi scale
    this.collisionBoxWidth = 50 // Fit với scale 0.065 và ảnh width 768
    this.collisionBoxHeight = 52 // Fit với scale 0.065 và ảnh height 803
    this.body.setSize(this.collisionBoxWidth, this.collisionBoxHeight)

    // Set standard rendering height
    this.standardHeight = 50 // T-Rex character
    // Do not set scale here, will be set in resetOriginAndOffset based on animation state

    // Set initial origin
    this.setOrigin(0.5, 1.0)

    // Create animations
    this.createAnimations()

    // Play idle animation
    this.play("trex_idle_anim")
    this.resetOriginAndOffset()

    // Initialize all sound effects
    this.initializeSounds()
  }

  // Initialize all sound effects
  initializeSounds() {
    this.jumpSound = this.scene.sound.add("jump_sound", { volume: 0.3 })
    this.shootSound = this.scene.sound.add("shoot_sound", { volume: 0.3 })
    this.powerupCollectSound = this.scene.sound.add("powerup_collect", { volume: 0.3 })
    this.springBounceSound = this.scene.sound.add("spring_boing", { volume: 0.3 })
    this.jetpackThrustSound = this.scene.sound.add("jetpack_thrust", { volume: 0.3 })
    this.propellerSpinningSound = this.scene.sound.add("propeller_spinning", { volume: 0.3 })
    
    // Initialize sound effect loop state
    this.jetpackSoundPlaying = false
    this.propellerSoundPlaying = false

    // Jetpack thrust effect
    this.jetpackThrustEmitter = null
    this.jetpackThrustActive = false
  }

  createAnimations() {
    const anims = this.scene.anims

    // Idle animation
    if (!anims.exists("trex_idle_anim")) {
      anims.create({
        key: "trex_idle_anim",
        frames: [{ key: "trex_idle" }],
        repeat: -1,
      })
    }

    // Shooting animation
    if (!anims.exists("trex_shooting_anim")) {
      anims.create({
        key: "trex_shooting_anim",
        frames: [{ key: "trex_shooting" }],
        repeat: 0,
      })
    }

    // Jetpack animation
    if (!anims.exists("trex_jetpack_anim")) {
      anims.create({
        key: "trex_jetpack_anim",
        frames: [{ key: "trex_jetpack" }],
        repeat: -1,
      })
    }

    // Spring shoes animation
    if (!anims.exists("trex_spring_shoes_anim")) {
      anims.create({
        key: "trex_spring_shoes_anim",
        frames: [{ key: "trex_spring_shoes" }],
        repeat: -1,
      })
    }

    // Propeller hat animation
    if (!anims.exists("trex_propeller_hat_anim")) {
      anims.create({
        key: "trex_propeller_hat_anim",
        frames: [{ key: "trex_propeller_hat" }],
        repeat: -1,
      })
    }
  }

  update(cursors, spaceKey) {
    if (!this.body || !this.active || this.isDead) {
      return
    }

    // Handle power-up status
    this.updatePowerupStates()

    // Handle shooting
    this.handleShooting(spaceKey)

    // Handle movement
    this.handleMovement(cursors)

    // Update animation
    this.updateAnimations()

    // Update jetpack thrust effect position
    this.updateJetpackThrust()

    // Check if fell out of screen
    this.checkFallOffScreen()
  }

  updatePowerupStates() {
    const currentTime = this.scene.time.now
    let newPowerupState = "normal"

    // Check propeller hat status (highest priority)
    if (this.hasPropellerHat) {
      if (currentTime - this.propellerHatStartTime > this.propellerHatDuration) {
        this.hasPropellerHat = false
        this.stopPropellerSound()
      } else {
        newPowerupState = "propellerhat"
        this.playPropellerSound()
      }
    }

    // Check jetpack status (second priority)
    if (this.hasJetpack && newPowerupState === "normal") {
      if (currentTime - this.jetpackStartTime > this.jetpackDuration) {
        this.hasJetpack = false
        this.stopJetpackSound()
        this.destroyJetpackThrust()
      } else {
        newPowerupState = "jetpack"
      }
    }

    // Check spring shoes status (lowest priority)
    if (this.hasSpringShoes && newPowerupState === "normal") {
      if (currentTime - this.springShoesStartTime > this.springShoesDuration) {
        this.hasSpringShoes = false
      } else {
        newPowerupState = "springshoes"
      }
    }

    // Stop unrelated sound effects
    if (newPowerupState !== "jetpack") {
      this.stopJetpackSound()
    }
    if (newPowerupState !== "propellerhat") {
      this.stopPropellerSound()
    }

    // Update animation status and force refresh
    if (this.currentPowerupState !== newPowerupState) {
      this.currentPowerupState = newPowerupState
      // Update animation immediately, do not wait for next updateAnimations call
      this.forceUpdateAnimation()
    }
  }

  // Sound effect management methods
  playJetpackSound() {
    if (!this.jetpackSoundPlaying) {
      this.jetpackSoundPlaying = true
      this.jetpackThrustSound.play({ loop: true })
    }
  }

  stopJetpackSound() {
    if (this.jetpackSoundPlaying) {
      this.jetpackSoundPlaying = false
      this.jetpackThrustSound.stop()
    }
  }

  playPropellerSound() {
    if (!this.propellerSoundPlaying) {
      this.propellerSoundPlaying = true
      this.propellerSpinningSound.play({ loop: true })
    }
  }

  stopPropellerSound() {
    if (this.propellerSoundPlaying) {
      this.propellerSoundPlaying = false
      this.propellerSpinningSound.stop()
    }
  }

  // Create jetpack thrust effect
  createJetpackThrust() {
    if (this.jetpackThrustEmitter && this.jetpackThrustActive) {
      return // Already active
    }

    // Position behind player (at the back, slightly below center)
    const thrustX = this.x
    const thrustY = this.y + (this.height * this.scaleY * 0.3) // Behind player's back

    // Create particle emitter for jetpack thrust
    this.jetpackThrustEmitter = this.scene.add.particles(thrustX, thrustY, 'ultra_tiny_bullet_dot', {
      speed: { min: 200, max: 350 },
      scale: { start: 0.15, end: 0.05 },
      tint: [0xff6600, 0xffaa00, 0xffff00], // Orange to yellow gradient
      lifespan: 300,
      frequency: 30, // Emit every 30ms for continuous effect
      angle: 90, // Downward direction (opposite of player movement)
      gravityY: -100, // Slight upward pull
      blendMode: 'ADD',
      emitting: true
    })

    this.jetpackThrustEmitter.setDepth(this.depth - 1) // Behind player
    this.jetpackThrustActive = true
  }

  // Update jetpack thrust position
  updateJetpackThrust() {
    if (this.jetpackThrustEmitter && this.jetpackThrustActive) {
      // Update position to follow player (behind back)
      const thrustX = this.x
      const thrustY = this.y + (this.height * this.scaleY * 0.3)
      
      // Update emitter position
      this.jetpackThrustEmitter.setPosition(thrustX, thrustY)
      
      // Adjust angle based on player facing direction
      if (this.facingDirection === "left") {
        this.jetpackThrustEmitter.setAngle(90) // Downward
      } else {
        this.jetpackThrustEmitter.setAngle(90) // Downward
      }
    }
  }

  // Destroy jetpack thrust effect
  destroyJetpackThrust() {
    if (this.jetpackThrustEmitter) {
      this.jetpackThrustEmitter.stop()
      // Destroy immediately if player is dead, otherwise fade out
      const delay = this.isDead ? 0 : 500
      this.scene.time.delayedCall(delay, () => {
        if (this.jetpackThrustEmitter) {
          this.jetpackThrustEmitter.destroy()
          this.jetpackThrustEmitter = null
        }
      })
      this.jetpackThrustActive = false
    }
  }

  // Method to force update animation
  forceUpdateAnimation() {
    // If currently shooting, do not force update other animations
    if (this.isShooting) {
      return
    }

    // Force play corresponding animation based on current power-up status
    let animKey = "trex_idle_anim"
    
    switch(this.currentPowerupState) {
      case "propellerhat":
        animKey = "trex_propeller_hat_anim"
        break
      case "jetpack":
        animKey = "trex_jetpack_anim"
        break
      case "springshoes":
        animKey = "trex_spring_shoes_anim"
        break
      default:
        animKey = "trex_idle_anim"
        break
    }

    // Force play animation, even if same animation key
    this.play(animKey, true)
    this.resetOriginAndOffset()
  }

  handleShooting(spaceKey) {
    const currentTime = this.scene.time.now

    if (Phaser.Input.Keyboard.JustDown(spaceKey) && this.canShoot) {
      if (currentTime - this.lastShootTime > this.shootCooldown) {
        this.shoot()
        this.lastShootTime = currentTime
      }
    }
  }

  shoot() {
    // Play shooting animation
    this.isShooting = true
    this.play("trex_shooting_anim", true)
    this.resetOriginAndOffset()

    // Get bullet from pool or create new one
    let bullet = this.scene.getBulletFromPool()
    if (!bullet) {
      bullet = this.scene.physics.add.sprite(this.x, this.y - 35, "ultra_tiny_bullet_dot")
      bullet.setScale(0.08) // Super small bullet
      bullet.body.setGravityY(200) // Add gravity effect
    } else {
      // Reuse bullet from pool
      bullet.setActive(true)
      bullet.setVisible(true)
      bullet.x = this.x
      bullet.y = this.y - 35
    }

    bullet.body.setVelocityY(-400) // Slightly slower initial speed
    this.shootSound.play()

    // Add bullet to scene bullet group
    this.scene.bullets.add(bullet)

    // Return to idle after shooting animation ends
    this.scene.time.delayedCall(this.shootingDuration, () => {
      this.isShooting = false
    })

    // Return bullet to pool when it goes off screen
    this.scene.time.delayedCall(2000, () => {
      if (bullet && bullet.active) {
        this.scene.returnBulletToPool(bullet)
      }
    })
  }

  handleMovement(cursors) {
    // Horizontal movement
    if (cursors.left.isDown) {
      this.body.setVelocityX(-this.moveSpeed)
      this.facingDirection = "left"
    } else if (cursors.right.isDown) {
      this.body.setVelocityX(this.moveSpeed)
      this.facingDirection = "right"
    } else {
      this.body.setVelocityX(0)
    }

    // Update facing direction
    this.setFlipX(this.facingDirection === "left")

    // Propeller hat control (highest priority) - continuous ascent
    if (this.hasPropellerHat) {
      this.body.setVelocityY(-this.propellerHatPower)
    }
    // Jetpack control (requires key press)
    else if (this.hasJetpack && (cursors.up.isDown || cursors.space?.isDown)) {
      this.body.setVelocityY(-this.jetpackPower)
      this.playJetpackSound()
      this.createJetpackThrust()
    } else if (this.hasJetpack && this.jetpackThrustActive) {
      // Jetpack is active but not being used - stop thrust and sound
      this.destroyJetpackThrust()
      this.stopJetpackSound()
    } else if (!this.hasJetpack && this.jetpackThrustActive) {
      // Jetpack expired - clean up
      this.destroyJetpackThrust()
    }

    // Screen boundary limit - cannot go beyond screen boundaries
    const screenWidth = this.scene.cameras.main.width
    const halfWidth = this.width * this.characterScale / 2

    if (this.x < halfWidth) {
      this.x = halfWidth
      this.body.setVelocityX(0)
    } else if (this.x > screenWidth - halfWidth) {
      this.x = screenWidth - halfWidth
      this.body.setVelocityX(0)
    }
  }

  updateAnimations() {
    // If currently shooting, do not update other animations
    if (this.isShooting) {
      return
    }

    // Play different animations based on power-up status
    let animKey = "trex_idle_anim"
    
    switch(this.currentPowerupState) {
      case "propellerhat":
        animKey = "trex_propeller_hat_anim"
        break
      case "jetpack":
        animKey = "trex_jetpack_anim"
        break
      case "springshoes":
        animKey = "trex_spring_shoes_anim"
        break
      default:
        animKey = "trex_idle_anim"
        break
    }

    this.play(animKey, true)
    this.resetOriginAndOffset()
  }

  resetOriginAndOffset() {
    // Return corresponding origin data and scale for different animations
    let baseOriginX = 0.5;
    let baseOriginY = 1.0;
    let scale = 0.1; // Base scale as reference
    
    const currentAnim = this.anims.currentAnim;
    if (currentAnim) {
      // Scale được tính toán để nhân vật có chiều cao khoảng 50-55 pixels
      // Ảnh gốc: 768x803 pixels
      // Scale = 52 / 803 ≈ 0.065
      switch(currentAnim.key) {
        case "trex_idle_anim":
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Base state - fit size cho khủng long (803px -> ~52px)
          break;
        case "trex_shooting_anim":
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Same size as idle
          break;
        case "trex_jetpack_anim":
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Same size as idle
          break;
        case "trex_spring_shoes_anim":
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Same size as idle
          break;
        case "trex_propeller_hat_anim":
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Same size as idle
          break;
        default:
          baseOriginX = 0.5;
          baseOriginY = 1.0;
          scale = 0.065; // Default
          break;
      }
    }

    // Set scale
    this.setScale(scale);

    let animOriginX = this.facingDirection === "left" ? (1 - baseOriginX) : baseOriginX;
    let animOriginY = baseOriginY;
    
    // Set origin
    this.setOrigin(animOriginX, animOriginY);
    
    // Calculate offset to align collision box bottomCenter with animation frame origin
    this.body.setOffset(
      this.width * animOriginX - this.collisionBoxWidth / 2, 
      this.height * animOriginY - this.collisionBoxHeight
    );
  }

  // Jump method
  jump(velocityY = null) {
    const jumpVelocity = velocityY || -this.jumpPower
    const multiplier = this.hasSpringShoes ? this.springShoesMultiplier : 1
    this.body.setVelocityY(jumpVelocity * multiplier)
    this.jumpSound.play()
  }

  // Spring jump
  springJump() {
    const springVelocity = -this.jumpPower * playerConfig.springBounceMultiplier.value
    const multiplier = this.hasSpringShoes ? this.springShoesMultiplier : 1
    this.body.setVelocityY(springVelocity * multiplier)
    this.springBounceSound.play()
  }

  // Collect power-up
  collectPowerup(powerupType) {
    this.powerupCollectSound.play()
    const currentTime = this.scene.time.now

    switch(powerupType) {
      case 'propeller_hat':
        this.hasPropellerHat = true
        this.propellerHatStartTime = currentTime
        this.currentPowerupState = "propellerhat"
        break
      case 'jetpack':
        this.hasJetpack = true
        this.jetpackStartTime = currentTime
        // Only switch to jetpack status when no propeller hat
        if (!this.hasPropellerHat) {
          this.currentPowerupState = "jetpack"
        }
        // Note: Jetpack thrust will be created when player presses up/space
        break
      case 'spring_shoes':
        this.hasSpringShoes = true
        this.springShoesStartTime = currentTime
        // Only switch to spring shoes status when no propeller hat or jetpack
        if (!this.hasPropellerHat && !this.hasJetpack) {
          this.currentPowerupState = "springshoes"
        }
        break
    }

    // Update animation immediately to reflect new power-up status
    this.forceUpdateAnimation()
  }

  checkFallOffScreen() {
    // Check is now handled in GameScene.updateHeight() - when height reaches 0
    // This method kept for compatibility but logic moved to scene
  }

  die() {
    if (this.isDead) return
    
    this.isDead = true
    this.body.setVelocity(0, 0)
    
    // Clean up jetpack thrust effect
    this.destroyJetpackThrust()
    
    // Save high score before game over
    if (this.scene.saveHighScore) {
      this.scene.saveHighScore()
    }
    
    // Play game over sound effect
    this.scene.sound.add("game_over", { volume: 0.3 }).play()
    
    // Start game over scene
    this.scene.scene.launch("GameOverScene")
  }
}