import "./main.scss";
import "bootstrap/js/dist/alert";
import "bootstrap/js/dist/collapse";

import { TestNodeProvider } from "./TestNodeProvider";
import { DomNodeRenderer } from "./Rendering";
import { INodeRenderer, Node } from "./Rendering/Abstractions";
import { ThreeJsDag3dEngine } from "./ThreeJsDag3dEngine";

document.addEventListener("DOMContentLoaded", async (e) => {
  const canvas = document.getElementsByTagName("canvas")[0];
  if (!canvas) return;

  const dag3dEngine = new ThreeJsDag3dEngine(canvas);
  await dag3dEngine.InitializeAsync();

  function animate() {
    requestAnimationFrame(animate);

    // Resize render area to fit canvas
    const newWidth = canvas.offsetWidth;
    const newHeight = canvas.offsetHeight;
    if (canvas.width !== newWidth || canvas.height !== newHeight)
      dag3dEngine.ResizeRenderArea(newWidth, newHeight);

    dag3dEngine.Update();
  }
  animate();
});

async function loadNodes() {
  const nodeProvider = new TestNodeProvider();
  const nodeRenderer: INodeRenderer = new DomNodeRenderer();

  const leafNodes: Node[] = await nodeProvider.GetLeafNodes();
  await nodeRenderer.RenderNodes(leafNodes);
}
