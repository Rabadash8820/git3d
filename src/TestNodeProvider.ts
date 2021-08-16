import { Node } from "./Rendering/Abstractions";

export class TestNodeProvider {
  GetLeafNodes(): Promise<Node[]> {
    const parent3 = new Node("3", "Third", null);
    const parent2 = new Node("2", "Second", parent3);
    const parent1 = new Node("1", "First", parent2);
    const leaf = new Node("0", "Leaf", parent1);
    return Promise.resolve([leaf]);
  }
}
