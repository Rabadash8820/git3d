import './main.scss';
import 'bootstrap/js/dist/collapse';

import { TestNodeProvider } from "./TestNodeProvider";
import { DomNodeRenderer } from "./Rendering";
import { INodeRenderer, Node } from "./Rendering/Abstractions";

document
  .getElementsByClassName("js-btn-start")[0]
  .addEventListener("click", async (e) => {
    await loadNodes();
  });

async function loadNodes() {
  const nodeProvider = new TestNodeProvider();
  const nodeRenderer: INodeRenderer = new DomNodeRenderer();

  const leafNodes: Node[] = await nodeProvider.GetLeafNodes();
  await nodeRenderer.RenderNodes(leafNodes);
}
