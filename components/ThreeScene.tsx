
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const ParticleField = () => {
  const particleCount = 800;
  const points = useMemo(() => {
    const p = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      p[i * 3] = (Math.random() - 0.5) * 25;
      p[i * 3 + 1] = (Math.random() - 0.5) * 25;
      p[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return p;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0002;
      ref.current.rotation.x += 0.0001;
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <Points ref={ref} positions={points} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#60a5fa"
        size={0.04}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
      />
    </Points>
  );
};

const HubCore = () => {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
      const targetX = state.mouse.x * 0.5;
      const targetY = state.mouse.y * 0.5;
      groupRef.current.position.x += (targetX - groupRef.current.position.x) * 0.05;
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.05;
    }
    if (outerRef.current) {
      outerRef.current.rotation.x += 0.01;
      outerRef.current.rotation.z += 0.005;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={outerRef}>
        <octahedronGeometry args={[2.5, 2]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          wireframe 
          transparent
          opacity={0.3}
          emissive="#1e40af" 
          emissiveIntensity={2}
        />
      </mesh>
      <Sphere args={[1.4, 64, 64]} ref={innerRef}>
        <MeshDistortMaterial
          color="#1d4ed8"
          attach="material"
          distort={0.4}
          speed={3}
          roughness={0}
          metalness={1}
          emissive="#2563eb"
          emissiveIntensity={0.5}
        />
      </Sphere>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.01, 16, 100]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

const Scene = () => (
  <>
    <ambientLight intensity={0.4} />
    <pointLight position={[10, 10, 10]} intensity={2} color="#ffffff" />
    <pointLight position={[-10, -10, -10]} intensity={1} color="#3b82f6" />
    <spotLight position={[0, 5, 10]} angle={0.15} penumbra={1} intensity={2} />
    <HubCore />
    <ParticleField />
  </>
);

const WebGLFallback = () => (
  <div className="fixed inset-0 z-0 bg-[#05070a] overflow-hidden flex items-center justify-center">
    {/* Animated background layers */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.5)_0%,_rgba(5,7,10,1)_70%)] opacity-80" />
    <div className="absolute inset-0 animated-gradient opacity-20" />
    
    {/* Glowing Hub Simulation using CSS */}
    <div className="relative w-96 h-96 flex items-center justify-center">
      <div className="absolute w-full h-full bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute w-64 h-64 border border-blue-500/20 rounded-full animate-[spin_20s_linear_infinite]" />
      <div className="absolute w-48 h-48 border border-teal-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
      <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-teal-400 rounded-3xl rotate-45 shadow-[0_0_80px_rgba(37,99,235,0.4)] blur-[2px] animate-bounce" style={{ animationDuration: '4s' }} />
    </div>

    {/* CSS Particles */}
    <div className="absolute inset-0 pointer-events-none opacity-40">
      {[...Array(20)].map((_, i) => (
        <div 
          key={i}
          className="absolute bg-blue-400/30 rounded-full blur-[1px]"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            animation: `float-css ${10 + Math.random() * 20}s linear infinite`,
            animationDelay: `-${Math.random() * 20}s`
          }}
        />
      ))}
    </div>

    <style>{`
      @keyframes float-css {
        0% { transform: translateY(0) translateX(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
      }
    `}</style>
  </div>
);

const ThreeScene: React.FC = React.memo(() => {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      } catch (e) {
        return false;
      }
    };
    setHasWebGL(checkWebGL());

    // Listen for context loss to switch to fallback gracefully
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("WebGL Context Lost. Switching to fallback.");
      setHasWebGL(false);
    };

    window.addEventListener('webglcontextlost', handleContextLost);
    return () => window.removeEventListener('webglcontextlost', handleContextLost);
  }, []);

  if (hasWebGL === false) {
    return <WebGLFallback />;
  }

  // Pre-load background while checking
  if (hasWebGL === null) {
    return <div className="fixed inset-0 z-0 bg-[#05070a]" />;
  }

  return (
    <div className="fixed inset-0 z-0 bg-[#05070a] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0)_0%,_rgba(5,7,10,1)_80%)] z-[1] pointer-events-none" />
      <div className="absolute inset-0 animated-gradient opacity-10 pointer-events-none" />
      
      <Canvas 
        camera={{ position: [0, 0, 12], fov: 45 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => setHasWebGL(false), { once: true });
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
});

export default ThreeScene;
