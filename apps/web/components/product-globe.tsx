"use client";

import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture } from "three";
import { products } from "../lib/mock-data";

export type CatalogProduct = typeof products[number];

type GlobeProps = {
  onProductChange: (product: CatalogProduct) => void;
  onProductSelect?: (product: CatalogProduct) => void;
};

function ProductSphere({ onProductChange, onProductSelect }: GlobeProps) {
  const textures = useTexture(products.map((product) => product.imageSrc));
  const { camera } = useThree();
  const frontProduct = useRef<CatalogProduct>(products[0]);
  const lastCheck = useRef(0);
  const atlasLayout = useMemo(() => {
    const tileCount = Math.max(products.length, 48);
    const columns = Math.ceil(Math.sqrt(tileCount * 2));
    const rows = Math.ceil(tileCount / columns);
    const tileSize = Math.max(24, Math.floor(4096 / columns));
    return { columns, rows, tileCount, tileSize };
  }, []);
  const mosaicTexture = useMemo(() => {
    const { columns, rows, tileCount, tileSize } = atlasLayout;
    const gutter = 8;
    const canvas = document.createElement("canvas");
    canvas.width = columns * tileSize;
    canvas.height = rows * tileSize;
    const context = canvas.getContext("2d");

    if (!context) return null;

    context.fillStyle = "#f3e3d5";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < tileCount; index += 1) {
      const image = textures[index % textures.length].image as CanvasImageSource;
      const x = (index % columns) * tileSize;
      const y = Math.floor(index / columns) * tileSize;
      context.drawImage(image, x + gutter, y + gutter, tileSize - gutter * 2, tileSize - gutter * 2);
    }

    return new CanvasTexture(canvas);
  }, [atlasLayout, textures]);

  useEffect(() => () => mosaicTexture?.dispose(), [mosaicTexture]);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCheck.current < 0.18) return;
    lastCheck.current = clock.elapsedTime;

    const angle = Math.atan2(camera.position.x, camera.position.z);
    const nextProduct = products[Math.abs(Math.round((angle / (Math.PI * 2)) * products.length)) % products.length];
    if (nextProduct.slug !== frontProduct.current.slug) {
      frontProduct.current = nextProduct;
      onProductChange(nextProduct);
    }
  });

  return (
    <mesh onClick={(event: ThreeEvent<MouseEvent>) => {
      if (!event.uv || !onProductSelect) return;
      event.stopPropagation();
      const column = Math.min(atlasLayout.columns - 1, Math.floor(event.uv.x * atlasLayout.columns));
      const row = Math.min(atlasLayout.rows - 1, Math.floor((1 - event.uv.y) * atlasLayout.rows));
      const imageIndex = (row * atlasLayout.columns + column) % products.length;
      onProductSelect(products[imageIndex]);
    }}>
      <sphereGeometry args={[2.28, 72, 72]} />
      <meshStandardMaterial map={mosaicTexture ?? undefined} roughness={0.52} metalness={0.04} />
    </mesh>
  );
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const verticalFov = (35 * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (size.width / size.height));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = 2.28 / Math.tan(limitingFov / 2) * 1.22;

    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

export function ProductGlobe({ onProductChange, onProductSelect }: GlobeProps) {
  return (
    <div className="product-globe-canvas">
      <Canvas camera={{ position: [0, 0, 12], fov: 35 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 4, 5]} intensity={2.1} />
        <ResponsiveCamera />
        <ProductSphere onProductChange={onProductChange} onProductSelect={onProductSelect} />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.55} rotateSpeed={0.65} />
      </Canvas>
      <p className="globe-hint">Drag the globe to discover every collection</p>
    </div>
  );
}
