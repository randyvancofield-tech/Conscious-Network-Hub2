
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Group = 'group' as any;
const Mesh = 'mesh' as any;
const OctahedronGeometry = 'octahedronGeometry' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;

const ParticleField = () => {
  const particleCount = 400;
  const points = useMemo(() => {
    const p = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      p[i * 3] = (Math.random() - 0.5) * 15;
      p[i * 3 + 1] = (Math.random() - 0.5) * 15;
      p[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return p;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0005;
      ref.current.rotation.x += 0.0002;
    }
  });

  return (
    <Points ref={ref} positions={points} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#3b82f6"
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
      />
    </Points>
  );
};

const HubCore = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
      meshRef.current.rotation.y += 0.004;
    }
  });

  return (
    <Group>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Mesh ref={meshRef}>
          <OctahedronGeometry args={[1.8, 1]} />
          <MeshStandardMaterial 
            color="#60a5fa" 
            wireframe 
            emissive="#1e3a8a" 
            emissiveIntensity={2}
          />
        </Mesh>
      </Float>
      
      <Sphere args={[1.1, 32, 32]}>
        <MeshDistortMaterial
          color="#1d4ed8"
          attach="material"
          distort={0.4}
          speed={3}
          roughness={0.2}
          metalness={1}
        />
      </Sphere>
    </Group>
  );
};

const ThreeScene: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 bg-[#05070a]">
      <Canvas 
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          alpha: true
        }}
      >
        <AmbientLight intensity={0.5} />
        <PointLight position={[10, 10, 10]} intensity={1.5} />
        <PointLight position={[-10, -10, -10]} color="#3b82f6" intensity={1} />
        <HubCore />
        <ParticleField />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.2} />
      </Canvas>
    </div>
  );
};

export default ThreeScene;
