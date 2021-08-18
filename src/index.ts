import "./main.scss";
import "bootstrap/js/dist/alert";
import "bootstrap/js/dist/collapse";

import { TestNodeProvider } from "./TestNodeProvider";
import { DomNodeRenderer } from "./Rendering";
import { INodeRenderer, Node } from "./Rendering/Abstractions";

async function loadNodes() {
  const nodeProvider = new TestNodeProvider();
  const nodeRenderer: INodeRenderer = new DomNodeRenderer();

  const leafNodes: Node[] = await nodeProvider.GetLeafNodes();
  await nodeRenderer.RenderNodes(leafNodes);
}
