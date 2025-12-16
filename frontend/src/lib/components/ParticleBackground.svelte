<script lang="ts">
  import { onMount } from 'svelte'

  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D | null
  let particles: Particle[] = []
  let animationFrameId: number

  const particleCount = 50
  const connectionDistance = 150

  class Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number

    constructor(width: number, height: number) {
      this.x = Math.random() * width
      this.y = Math.random() * height
      this.vx = (Math.random() - 0.5) * 0.5
      this.vy = (Math.random() - 0.5) * 0.5
      this.size = Math.random() * 2 + 1
    }

    update(width: number, height: number) {
      this.x += this.vx
      this.y += this.vy

      if (this.x < 0 || this.x > width) this.vx *= -1
      if (this.y < 0 || this.y > height) this.vy *= -1
    }

    draw(ctx: CanvasRenderingContext2D) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(100, 116, 139, 0.2)' // Slate-500 with low opacity
      ctx.fill()
    }
  }

  function init() {
    resize()
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height))
    }
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
  }

  function animate() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particles.forEach((particle) => {
      particle.update(canvas.width, canvas.height)
      if (ctx) particle.draw(ctx)
    })

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < connectionDistance) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(100, 116, 139, ${
            0.1 * (1 - distance / connectionDistance)
          })`
          ctx.lineWidth = 1
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.stroke()
        }
      }
    }

    animationFrameId = requestAnimationFrame(animate)
  }

  onMount(() => {
    ctx = canvas.getContext('2d')
    init()
    animate()

    window.addEventListener('resize', () => {
      resize()
      // Re-initialize particles on resize to prevent them from getting stuck outside
      init()
    })

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
    }
  })
</script>

<canvas
  bind:this={canvas}
  class="fixed inset-0 z-0 pointer-events-none w-full h-full opacity-50"
></canvas>
