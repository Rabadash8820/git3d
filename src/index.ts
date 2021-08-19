import "./main.scss";
import "bootstrap/js/dist/alert";
import "bootstrap/js/dist/collapse";
import * as Three from "three";

import { TestNodeProvider } from "./TestNodeProvider";
import { DomNodeRenderer } from "./Rendering";
import { INodeRenderer, Node } from "./Rendering/Abstractions";

document.addEventListener("DOMContentLoaded", (e) => {
  const canvas = document.getElementsByTagName("canvas")[0];
  if (!canvas) return;
  initializeRendering(canvas);
});

function initializeRendering(canvas: HTMLCanvasElement) {
  const scene = new Three.Scene();

  // Aspect ratio will technically be reset every frame, but whatever
  const camera = new Three.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000
  );

  const renderer = new Three.WebGLRenderer({ canvas: canvas, antialias: true });

  const geometry = new Three.BoxGeometry();
  const material = new Three.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new Three.Mesh(geometry, material);
  scene.add(cube);

  camera.position.z = 5;

  function animate() {
    requestAnimationFrame(animate);

    fitCanvasToDisplay(canvas);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();

  function fitCanvasToDisplay(canvas: HTMLCanvasElement) {
    const newWidth = canvas.offsetWidth;
    const newHeight = canvas.offsetHeight;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      renderer.setSize(newWidth, newHeight, false); // Must pass false here or three.js sadly fights the browser
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    }
  }
}

async function loadNodes() {
  const nodeProvider = new TestNodeProvider();
  const nodeRenderer: INodeRenderer = new DomNodeRenderer();

  const leafNodes: Node[] = await nodeProvider.GetLeafNodes();
  await nodeRenderer.RenderNodes(leafNodes);
}
