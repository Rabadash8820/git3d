import { INodeRenderer, Node } from "./Abstractions";

const outputElem = document.getElementsByClassName("js-output")[0];

export class DomNodeRenderer implements INodeRenderer {
  async RenderNodes(nodes: Node[]): Promise<void> {
    for (let n = 0; n < nodes.length; ++n) {
      const labels: string[] = [];
      let node: Node | null = nodes[n];
      do {
        labels.push(node.Label);
        node = node.Parent;
      } while (node);

      outputElem.textContent = labels.join(" -> ");
    }
  }
}
