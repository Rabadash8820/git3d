/**
 * Represents a node in a directed acyclic graph
 */
export class Node {
  Id: string;
  Label: string;
  Parent: Node | null;
  constructor(id: string, label: string, parent: Node | null) {
    this.Id = id;
    this.Label = label;
    this.Parent = parent;
  }
}

export interface INodeRenderer {
  RenderNodes(leafNodes: Node[]): Promise<void>;
}
