'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  rotationZ: number
  rotationY: number
  rotationSpeedZ: number
  rotationSpeedY: number
  wobblePhase: number
  wobbleSpeed: number
}

export default function Snowfall({ count = 200 }: { count?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (!mounted || !containerRef.current) return
    
    const container = containerRef.current
    
    // Determine snow visuals based on device
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const particleCount = isMobile ? Math.max(80, Math.floor(count * 0.6)) : count
    const sizeRange = isMobile
      ? { min: 6, max: 14 }
      : { min: 8, max: 22 }

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      0.1,
      1000
    )
    camera.position.z = 100
    
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'low-power'
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    
    // Create snowflake texture
    const rootStyles = getComputedStyle(document.documentElement)
    const snowColor = rootStyles.getPropertyValue('--color-accent-green').trim() || '#33ff33'
    const color = new THREE.Color(snowColor)

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    
    // Draw a soft snowflake
    ctx.fillStyle = snowColor
    ctx.font = '48px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('❄', 32, 32)
    
    const texture = new THREE.CanvasTexture(canvas)
    
    // Particle data
    const particles: Particle[] = []
    const positions = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const rotationsZ = new Float32Array(particleCount)
    const rotationsY = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      const particle: Particle = {
        x: (Math.random() - 0.5) * window.innerWidth,
        y: window.innerHeight / 2 + Math.random() * window.innerHeight, // Start above the viewport
        z: Math.random() * 50,
        vx: 0,
        vy: -(Math.random() * 20 + 18), // Faster fall: 18-38 pixels per second
        vz: 0,
        size: Math.random() * (sizeRange.max - sizeRange.min) + sizeRange.min,
        rotationZ: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        rotationSpeedZ: (Math.random() - 0.5) * 1.2 + (Math.random() > 0.5 ? 0.4 : -0.4), // Natural tumble
        rotationSpeedY: (Math.random() - 0.5) * 2.0 + (Math.random() > 0.5 ? 0.6 : -0.6), // Y-axis tumble
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.5 + 0.3,
      }
      particles.push(particle)
      
      positions[i * 3] = particle.x
      positions[i * 3 + 1] = particle.y
      positions[i * 3 + 2] = particle.z
      sizes[i] = particle.size
      rotationsZ[i] = particle.rotationZ
      rotationsY[i] = particle.rotationY
    }
    
    // Custom shader material for snowflakes with Y rotation (scale X based on Y rotation)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uColor: { value: color },
      },
      vertexShader: `
        attribute float size;
        attribute float rotationZ;
        attribute float rotationY;
        varying float vRotationZ;
        varying float vScaleX;
        varying float vOpacity;

        void main() {
          vRotationZ = rotationZ;
          // Y rotation affects apparent width (like a coin flip)
          vScaleX = abs(cos(rotationY));
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          
          // Fade based on depth
          vOpacity = 0.4 + 0.5 * (position.z / 50.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying float vRotationZ;
        varying float vScaleX;
        varying float vOpacity;
        uniform vec3 uColor;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          
          // Apply Z rotation
          float c = cos(vRotationZ);
          float s = sin(vRotationZ);
          vec2 rotated = vec2(
            center.x * c - center.y * s,
            center.x * s + center.y * c
          );
          
          // Apply Y rotation (squish X)
          rotated.x /= max(vScaleX, 0.1);
          
          // Check if we're still in bounds after squishing
          if (abs(rotated.x) > 0.5 || abs(rotated.y) > 0.5) discard;
          
          vec2 uv = rotated + 0.5;
          vec4 texColor = texture2D(uTexture, uv);
          if (texColor.a < 0.1) discard;

          gl_FragColor = vec4(uColor, texColor.a * vOpacity * vScaleX);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('rotationZ', new THREE.BufferAttribute(rotationsZ, 1))
    geometry.setAttribute('rotationY', new THREE.BufferAttribute(rotationsY, 1))
    
    const points = new THREE.Points(geometry, material)
    scene.add(points)
    
    // Mouse tracking for wind effect
    const mouse = { x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0 }
    let lastMouseMove = 0
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now()
      const dt = Math.max(now - lastMouseMove, 1) / 1000
      
      mouse.prevX = mouse.x
      mouse.prevY = mouse.y
      mouse.x = e.clientX - window.innerWidth / 2
      mouse.y = -(e.clientY - window.innerHeight / 2)
      
      // Calculate mouse velocity
      mouse.vx = (mouse.x - mouse.prevX) / dt
      mouse.vy = (mouse.y - mouse.prevY) / dt
      
      lastMouseMove = now
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        const now = performance.now()
        const dt = Math.max(now - lastMouseMove, 1) / 1000
        
        mouse.prevX = mouse.x
        mouse.prevY = mouse.y
        mouse.x = touch.clientX - window.innerWidth / 2
        mouse.y = -(touch.clientY - window.innerHeight / 2)
        
        mouse.vx = (mouse.x - mouse.prevX) / dt
        mouse.vy = (mouse.y - mouse.prevY) / dt
        
        lastMouseMove = now
      }
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    
    // Animation
    let lastTime = performance.now()
    let animationId: number
    let time = 0

    const warmupDelay = 0.6
    const warmupDuration = 3.6
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.1) // Cap delta time
      lastTime = now
      time += dt
      
      // Decay mouse velocity
      mouse.vx *= 0.92
      mouse.vy *= 0.92
      
      const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const rotationZAttr = geometry.getAttribute('rotationZ') as THREE.BufferAttribute
      const rotationYAttr = geometry.getAttribute('rotationY') as THREE.BufferAttribute

      const warmupElapsed = Math.max(0, time - warmupDelay)
      const warmupProgress = Math.min(1, warmupElapsed / warmupDuration)
      const easedWarmup = easeInOutCubic(warmupProgress)
      const activeCount = Math.floor(particleCount * easedWarmup)
      const intensity = activeCount > 0 ? Math.max(0.15, easedWarmup) : 0

      geometry.setDrawRange(0, activeCount)

      for (let i = 0; i < activeCount; i++) {
        const particle = particles[i]
        
        // Only apply wind if mouse is actually moving
        const mouseSpeed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy)
        
        if (mouseSpeed > 50) { // Threshold to ignore tiny movements
          const dx = particle.x - mouse.x
          const dy = particle.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Wind force from mouse movement - MUCH more dramatic
          const windRadius = 250
          if (dist < windRadius) {
            const force = Math.pow(1 - dist / windRadius, 2) * 2.5 * intensity // Quadratic falloff, 2.5x multiplier
            particle.vx += mouse.vx * force * dt
            particle.vy += mouse.vy * force * dt

            // Push away slightly from cursor too
            const pushForce = (1 - dist / windRadius) * 50
            particle.vx += (dx / dist) * pushForce * dt * intensity
            particle.vy += (dy / dist) * pushForce * dt * intensity

            // Dramatically increase spin when disturbed
            particle.rotationSpeedZ += (Math.random() - 0.5) * force * 8
            particle.rotationSpeedY += (Math.random() - 0.5) * force * 12
          }
        }

        // Natural wobble (gentle side-to-side drift)
        particle.wobblePhase += particle.wobbleSpeed * dt * intensity
        const wobbleForce = Math.sin(particle.wobblePhase) * 3 * intensity
        particle.vx += wobbleForce * dt
        
        // Apply gentle drift back to falling straight
        particle.vx *= 0.985
        particle.vz *= 0.98

        // Gravity (constant fall)
        const baseSpeed = 25 + (particle.size / 22) * 30
        const targetFallSpeed = (-baseSpeed) * (0.25 + intensity * 0.75)
        particle.vy += (targetFallSpeed - particle.vy) * 0.02
        
        // Update position
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.z += particle.vz * dt
        
        // Update rotations
        particle.rotationZ += particle.rotationSpeedZ * dt
        particle.rotationY += particle.rotationSpeedY * dt
        
        // Dampen rotation speeds back to natural tumble (not zero)
        const targetSpinZ = (Math.random() - 0.5) * 1.0 + (particle.rotationSpeedZ > 0 ? 0.3 : -0.3)
        const targetSpinY = (Math.random() - 0.5) * 1.5 + (particle.rotationSpeedY > 0 ? 0.5 : -0.5)
        particle.rotationSpeedZ += (targetSpinZ - particle.rotationSpeedZ) * 0.01
        particle.rotationSpeedY += (targetSpinY - particle.rotationSpeedY) * 0.01
        
        // Wrap around edges
        if (particle.y < -window.innerHeight / 2 - 30) {
          particle.y = window.innerHeight / 2 + 30
          particle.x = (Math.random() - 0.5) * window.innerWidth
          particle.vx = 0
          particle.vy = -(Math.random() * 20 + 18)
          particle.rotationSpeedZ = (Math.random() - 0.5) * 1.2 + (Math.random() > 0.5 ? 0.4 : -0.4)
          particle.rotationSpeedY = (Math.random() - 0.5) * 2.0 + (Math.random() > 0.5 ? 0.6 : -0.6)
        }
        if (particle.x < -window.innerWidth / 2 - 50) {
          particle.x = window.innerWidth / 2 + 50
        }
        if (particle.x > window.innerWidth / 2 + 50) {
          particle.x = -window.innerWidth / 2 - 50
        }
        
        // Update buffer
        positionAttr.array[i * 3] = particle.x
        positionAttr.array[i * 3 + 1] = particle.y
        positionAttr.array[i * 3 + 2] = particle.z
        rotationZAttr.array[i] = particle.rotationZ
        rotationYAttr.array[i] = particle.rotationY
      }
      
      positionAttr.needsUpdate = true
      rotationZAttr.needsUpdate = true
      rotationYAttr.needsUpdate = true
      
      material.uniforms.uTime.value = time
      
      renderer.render(scene, camera)
    }
    
    animate()
    
    // Handle resize
    const handleResize = () => {
      camera.left = -window.innerWidth / 2
      camera.right = window.innerWidth / 2
      camera.top = window.innerHeight / 2
      camera.bottom = -window.innerHeight / 2
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    }
  }, [mounted, count])
  
  if (!mounted) return null
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
      aria-hidden="true"
    />
  )
}
