import { OrbitControls, Preload, RoundedBox, Sparkles, useTexture } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import type { Group, ShaderMaterial } from 'three'
import { MathUtils, SRGBColorSpace, Vector3 } from 'three'
import type { Memory } from '../../domain/types'
import { getMemoryPosition, getParticleCount, type MemorySceneMode } from './sceneLayout'

interface UniverseProps {
  memories: Memory[]
  mode: MemorySceneMode
  selectedId?: string
  onSelect: (memory: Memory) => void
  reducedMotion: boolean
}

function DuskBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<ShaderMaterial>(null)

  useFrame((_, delta) => {
    if (material.current && !reducedMotion) {
      material.current.uniforms.uTime.value += delta
    }
  })

  return (
    <mesh position={[0, 0, -9]} scale={[1.45, 1.2, 1]}>
      <planeGeometry args={[18, 12]} />
      <shaderMaterial
        ref={material}
        depthWrite={false}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vec3 plum = vec3(0.11, 0.06, 0.17);
            vec3 lavender = vec3(0.32, 0.22, 0.40);
            vec3 peach = vec3(0.82, 0.38, 0.31);
            float horizon = smoothstep(0.0, 0.95, 1.0 - vUv.y);
            float glow = 0.025 * sin(vUv.x * 7.0 + uTime * 0.08);
            vec3 color = mix(plum, lavender, horizon * 0.48);
            color = mix(color, peach, smoothstep(0.66, 1.0, horizon) * 0.42);
            gl_FragColor = vec4(color + glow, 1.0);
          }
        `}
      />
    </mesh>
  )
}

function MemoryLantern({
  memory,
  index,
  mode,
  selected,
  onSelect,
}: {
  memory: Memory
  index: number
  mode: MemorySceneMode
  selected: boolean
  onSelect: () => void
}) {
  const texture = useTexture(memory.photos[0] || '/assets/memory-sunlit-nap.jpg')
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const target = useMemo(() => new Vector3(...getMemoryPosition(memory, index, mode)), [memory, index, mode])
  texture.colorSpace = SRGBColorSpace

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.position.lerp(target, 1 - Math.exp(-delta * 3.8))
    const scale = selected ? 1.22 : hovered ? 1.1 : 1
    group.current.scale.lerp(new Vector3(scale, scale, scale), 1 - Math.exp(-delta * 8))
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, mode === 'galaxy' ? -target.x * 0.035 : 0, delta * 4)
  })

  return (
    <group ref={group} position={getMemoryPosition(memory, index, mode)}>
      <RoundedBox args={[1.74, 1.28, 0.12]} radius={0.11} smoothness={4}>
        <meshStandardMaterial
          color={selected ? '#f4c66d' : '#f7d3c8'}
          emissive={selected ? '#e88f78' : '#5d375b'}
          emissiveIntensity={selected ? 0.85 : 0.18}
          roughness={0.42}
        />
      </RoundedBox>
      <mesh
        position={[0, 0, 0.075]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onPointerEnter={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerLeave={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[1.58, 1.1]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {memory.isHighlight && (
        <mesh position={[0.76, 0.55, 0.18]}>
          <sphereGeometry args={[0.085, 20, 20]} />
          <meshStandardMaterial color="#f4c66d" emissive="#f4c66d" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  )
}

function Scene({ memories, mode, selectedId, onSelect, reducedMotion }: UniverseProps) {
  const sceneGroup = useRef<Group>(null)
  const particleCount = getParticleCount(typeof window === 'undefined' ? 1440 : window.innerWidth, reducedMotion)

  useFrame((state, delta) => {
    if (!sceneGroup.current || reducedMotion) return
    sceneGroup.current.rotation.y = MathUtils.lerp(
      sceneGroup.current.rotation.y,
      state.pointer.x * 0.08,
      delta * 1.8,
    )
    sceneGroup.current.rotation.x = MathUtils.lerp(
      sceneGroup.current.rotation.x,
      -state.pointer.y * 0.045,
      delta * 1.8,
    )
  })

  return (
    <>
      <color attach="background" args={['#241a32']} />
      <fog attach="fog" args={['#241a32', 8, 18]} />
      <DuskBackdrop reducedMotion={reducedMotion} />
      <ambientLight intensity={0.7} color="#a998d8" />
      <pointLight position={[0, 1.5, 4]} intensity={18} distance={15} color="#ef9f82" />
      <pointLight position={[-4, -2, 1]} intensity={10} distance={10} color="#8b79c7" />
      <group ref={sceneGroup} position={[0, -0.35, 0]}>
        <mesh position={[0, 0.15, -6]}>
          <sphereGeometry args={[0.54, 48, 48]} />
          <meshStandardMaterial color="#d77f6b" emissive="#e88f78" emissiveIntensity={1.3} roughness={0.25} />
        </mesh>
        <Sparkles count={particleCount} scale={[16, 9, 9]} size={2.2} speed={0.16} color="#f4c66d" opacity={0.58} />
        {memories.map((memory, index) => (
          <MemoryLantern
            key={memory.id}
            memory={memory}
            index={index}
            mode={mode}
            selected={selectedId === memory.id}
            onSelect={() => onSelect(memory)}
          />
        ))}
      </group>
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={7}
        maxDistance={14}
        autoRotate={!reducedMotion && mode === 'galaxy'}
        autoRotateSpeed={0.18}
      />
      <Preload all />
    </>
  )
}

export function MemoryUniverse(props: UniverseProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.3, 10], fov: 48 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}
